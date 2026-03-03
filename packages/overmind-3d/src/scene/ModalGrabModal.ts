import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── Axis colors ─────────────────────────────────────────────────────────────

const AXIS_COLORS: Record<string, number> = {
  x: 0xff4444, // red
  y: 0x44ff44, // green
  z: 0x4488ff, // blue
};

// ── State ────────────────────────────────────────────────────────────────────

interface GrabState {
  objectId: string;
  object: THREE.Object3D;
  initialPosition: THREE.Vector3;
  axis: 'free' | 'x' | 'y' | 'z';
  plane: THREE.Plane;
  initialHitPoint: THREE.Vector3 | null; // null = lazy init on 1st mousemove
  numericMode: boolean;
  numericBuffer: string;
  guideLine: THREE.Line | null;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class ModalGrabModal {
  private host: SelectionHost;
  private state: GrabState | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private raycaster = new THREE.Raycaster();

  private boundMove: ((e: MouseEvent) => void) | null = null;
  private boundBlur: (() => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;

  private hudCallback: ((text: string | null) => void) | null = null;

  constructor(host: SelectionHost) {
    this.host = host;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  isActive(): boolean {
    return this.state !== null;
  }

  setHudCallback(cb: (text: string | null) => void): void {
    this.hudCallback = cb;
  }

  enter(camera: THREE.PerspectiveCamera): boolean {
    const selectedId = this.host.getSelectedId();
    if (!selectedId || this.host.isAnyModalActive()) return false;
    const obj = this.host.getSelectables().get(selectedId);
    if (!obj) return false;

    this.camera = camera;

    // Detach gizmo — modal grab replaces it
    this.host.detachGizmo();

    // Compute projection plane (perpendicular to camera, through object)
    const cameraDir = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, obj.position);

    this.state = {
      objectId: selectedId,
      object: obj,
      initialPosition: obj.position.clone(),
      axis: 'free',
      plane,
      initialHitPoint: null, // lazy init on 1st mousemove
      numericMode: false,
      numericBuffer: '',
      guideLine: null,
    };

    // Disable camera + undo checkpoint
    this.host.fireDraggingChanged(true);

    // Capture multi-select state for propagation
    if (this.host.getSelectedIds().length > 1) {
      this.host.computeMultiPivot();
      this.host.saveMultiInitialTransforms();
    }

    // Attach listeners (modal: mousedown + keydown in capture phase)
    this.boundMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundBlur = () => this.cancel();
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundContextMenu = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };

    window.addEventListener('mousemove', this.boundMove);
    window.addEventListener('blur', this.boundBlur);
    window.addEventListener('mousedown', this.boundMouseDown, true);
    window.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('contextmenu', this.boundContextMenu, true);

    this.updateHud();
    return true;
  }

  confirm(): void {
    if (!this.state) return;

    // Apply numeric value if in numeric mode
    if (this.state.numericMode && this.state.numericBuffer) {
      const value = parseFloat(this.state.numericBuffer);
      if (!isNaN(value)) {
        this.applyNumericOffset(value);
      }
    }

    this.syncTransform();
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
    this.camera = null;
  }

  cancel(): void {
    if (!this.state) return;
    const { object, initialPosition } = this.state;

    // Restore original position
    object.position.copy(initialPosition);

    // Restore non-primary objects
    const transforms = this.host.getMultiInitialTransforms();
    for (const [id, initial] of transforms) {
      const other = this.host.getSelectables().get(id);
      if (other) {
        other.position.copy(initial.position);
      }
    }
    transforms.clear();
    if (this.host.getSelectedIds().length > 1) this.host.broadcastMultiChanges();

    this.syncTransform();
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
    this.camera = null;
  }

  // ── Private: event handlers ────────────────────────────────────────────────

  private onMouseMove(e: MouseEvent): void {
    if (!this.state || !this.camera) return;

    // In numeric mode, mouse movement is ignored
    if (this.state.numericMode) return;

    const ndc = this.clientToNDC(e.clientX, e.clientY);

    // Lazy init: compute initialHitPoint on 1st mousemove
    if (!this.state.initialHitPoint) {
      const hitPoint = this.raycastPlane(ndc);
      if (!hitPoint) return;
      this.state.initialHitPoint = hitPoint;
      return; // 1st mousemove = calibration only
    }

    const hitPoint = this.raycastPlane(ndc);
    if (!hitPoint) return;

    // Compute world-space delta
    const delta = hitPoint.clone().sub(this.state.initialHitPoint);

    // Apply axis constraint
    const constrainedDelta = this.constrainDelta(delta);

    // Apply to primary object
    this.state.object.position.copy(this.state.initialPosition).add(constrainedDelta);

    // Propagate to non-primary objects
    this.propagateMultiSelect(constrainedDelta);

    // Sync actors
    this.syncTransform();
    this.updateHud();
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.state) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.button === 0) {
      this.confirm();   // left click = confirm
    } else {
      this.cancel();    // right/middle click = cancel
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.state) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const key = e.key.toLowerCase();

    // Axis constraints (toggle)
    if (key === 'x' || key === 'y' || key === 'z') {
      if (!this.state.numericMode) {
        const newAxis = key as 'x' | 'y' | 'z';
        this.state.axis = this.state.axis === newAxis ? 'free' : newAxis;
        this.updateGuideLine();
        // Reapply current position with new constraint
        this.reapplyConstraint();
        this.updateHud();
        return;
      }
    }

    // Numeric input
    if (key >= '0' && key <= '9') {
      this.state.numericMode = true;
      this.state.numericBuffer += key;
      this.updateHud();
      return;
    }
    if (key === '-') {
      this.state.numericMode = true;
      if (this.state.numericBuffer === '' || this.state.numericBuffer === '-') {
        this.state.numericBuffer = this.state.numericBuffer === '-' ? '' : '-';
      }
      this.updateHud();
      return;
    }
    if (key === '.' && this.state.numericMode && !this.state.numericBuffer.includes('.')) {
      this.state.numericBuffer += '.';
      this.updateHud();
      return;
    }
    if (key === 'backspace') {
      if (this.state.numericMode) {
        this.state.numericBuffer = this.state.numericBuffer.slice(0, -1);
        if (this.state.numericBuffer === '' || this.state.numericBuffer === '-') {
          this.state.numericMode = false;
          this.state.numericBuffer = '';
        }
        this.updateHud();
      }
      return;
    }

    // Confirm / Cancel
    if (key === 'enter') { this.confirm(); return; }
    if (key === 'escape') { this.cancel(); return; }
  }

  // ── Private: helpers ───────────────────────────────────────────────────────

  private clientToNDC(clientX: number, clientY: number): THREE.Vector2 {
    const canvas = this.host.getCanvas();
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private raycastPlane(ndc: THREE.Vector2): THREE.Vector3 | null {
    if (!this.camera || !this.state) return null;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hitPoint = new THREE.Vector3();
    const result = this.raycaster.ray.intersectPlane(this.state.plane, hitPoint);
    return result ? hitPoint : null;
  }

  private constrainDelta(delta: THREE.Vector3): THREE.Vector3 {
    if (!this.state || this.state.axis === 'free') return delta.clone();
    const axisVec = new THREE.Vector3(
      this.state.axis === 'x' ? 1 : 0,
      this.state.axis === 'y' ? 1 : 0,
      this.state.axis === 'z' ? 1 : 0,
    );
    return axisVec.multiplyScalar(delta.dot(axisVec));
  }

  private propagateMultiSelect(delta: THREE.Vector3): void {
    const selectedIds = this.host.getSelectedIds();
    if (selectedIds.length <= 1) return;

    const transforms = this.host.getMultiInitialTransforms();
    for (const id of selectedIds) {
      if (id === this.state?.objectId) continue;
      const other = this.host.getSelectables().get(id);
      if (!other) continue;
      const initial = transforms.get(id);
      if (!initial) continue;
      other.position.copy(initial.position).add(delta);
    }
    this.host.broadcastMultiChanges();
  }

  private applyNumericOffset(value: number): void {
    if (!this.state) return;
    const { object, initialPosition, axis } = this.state;

    if (axis === 'free') {
      // In free mode with numeric: apply to all axes (like Blender)
      object.position.copy(initialPosition).addScalar(value);
    } else {
      object.position.copy(initialPosition);
      if (axis === 'x') object.position.x += value;
      else if (axis === 'y') object.position.y += value;
      else if (axis === 'z') object.position.z += value;
    }

    // Propagate to multi-select
    const delta = object.position.clone().sub(initialPosition);
    this.propagateMultiSelect(delta);
  }

  /** Reapply the current mouse-driven delta with the new axis constraint */
  private reapplyConstraint(): void {
    if (!this.state || !this.state.initialHitPoint || this.state.numericMode) return;
    // We need the last mouse position — but we don't store it.
    // Instead, compute delta from current object position vs initial,
    // and re-project it on the new axis.
    // This is an approximation — the next mousemove will correct it precisely.
    const currentDelta = this.state.object.position.clone().sub(this.state.initialPosition);
    const constrainedDelta = this.constrainDelta(currentDelta);
    this.state.object.position.copy(this.state.initialPosition).add(constrainedDelta);

    // Propagate
    this.propagateMultiSelect(constrainedDelta);
    this.syncTransform();
  }

  private syncTransform(): void {
    if (!this.state) return;
    const { objectId, object } = this.state;
    this.host.fireObjectChange(objectId, {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.clone(),
    });
  }

  // ── Guide line ──────────────────────────────────────────────────────────────

  private updateGuideLine(): void {
    if (!this.state) return;

    // Remove existing guide line
    if (this.state.guideLine) {
      this.host.getScene().remove(this.state.guideLine);
      this.state.guideLine.geometry.dispose();
      (this.state.guideLine.material as THREE.Material).dispose();
      this.state.guideLine = null;
    }

    // No guide line in free mode
    if (this.state.axis === 'free') return;

    const color = AXIS_COLORS[this.state.axis] ?? 0xffffff;
    const axisVec = new THREE.Vector3(
      this.state.axis === 'x' ? 1 : 0,
      this.state.axis === 'y' ? 1 : 0,
      this.state.axis === 'z' ? 1 : 0,
    );

    const origin = this.state.initialPosition;
    const lineLen = 100;
    const p1 = origin.clone().add(axisVec.clone().multiplyScalar(-lineLen));
    const p2 = origin.clone().add(axisVec.clone().multiplyScalar(lineLen));

    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const material = new THREE.LineBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.5,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 9999;
    line.frustumCulled = false;

    this.host.getScene().add(line);
    this.state.guideLine = line;
  }

  // ── HUD ─────────────────────────────────────────────────────────────────────

  private updateHud(): void {
    if (!this.state || !this.hudCallback) return;
    const { axis, numericMode, numericBuffer, object, initialPosition } = this.state;

    const delta = object.position.clone().sub(initialPosition);
    const axisLabel = axis === 'free' ? '' : ` ${axis.toUpperCase()}`;

    if (numericMode) {
      const value = numericBuffer || '0';
      this.hudCallback(`G${axisLabel}: ${value}`);
    } else if (axis === 'free') {
      const dx = Math.round(delta.x * 100) / 100;
      const dy = Math.round(delta.y * 100) / 100;
      const dz = Math.round(delta.z * 100) / 100;
      this.hudCallback(`G: ${dx}, ${dy}, ${dz}`);
    } else {
      const val = axis === 'x' ? delta.x : axis === 'y' ? delta.y : delta.z;
      this.hudCallback(`G${axisLabel}: ${Math.round(val * 100) / 100}`);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  private cleanup(): void {
    if (!this.state) return;

    // Remove guide line
    if (this.state.guideLine) {
      this.host.getScene().remove(this.state.guideLine);
      this.state.guideLine.geometry.dispose();
      (this.state.guideLine.material as THREE.Material).dispose();
      this.state.guideLine = null;
    }

    // Remove listeners
    if (this.boundMove) {
      window.removeEventListener('mousemove', this.boundMove);
      this.boundMove = null;
    }
    if (this.boundBlur) {
      window.removeEventListener('blur', this.boundBlur);
      this.boundBlur = null;
    }
    if (this.boundMouseDown) {
      window.removeEventListener('mousedown', this.boundMouseDown, true);
      this.boundMouseDown = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown, true);
      this.boundKeyDown = null;
    }
    if (this.boundContextMenu) {
      window.removeEventListener('contextmenu', this.boundContextMenu, true);
      this.boundContextMenu = null;
    }

    this.hudCallback?.(null);
  }
}
