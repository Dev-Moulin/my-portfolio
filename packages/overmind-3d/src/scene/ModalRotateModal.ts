import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── Axis colors ─────────────────────────────────────────────────────────────

const AXIS_COLORS: Record<string, number> = {
  x: 0xff4444, // red
  y: 0x44ff44, // green
  z: 0x4488ff, // blue
};

// ── State ────────────────────────────────────────────────────────────────────

interface RotateState {
  objectId: string;
  object: THREE.Object3D;
  initialQuaternion: THREE.Quaternion;
  axis: 'view' | 'x' | 'y' | 'z';
  rotationAxis: THREE.Vector3;
  centerScreen: { x: number; y: number } | null; // lazy init on 1st mousemove
  initialAngle: number | null;
  currentAngleDeg: number;
  numericMode: boolean;
  numericBuffer: string;
  guideLine: THREE.Line | null;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class ModalRotateModal {
  private host: SelectionHost;
  private state: RotateState | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

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

    // Detach gizmo — modal rotate replaces it
    this.host.detachGizmo();

    // Default axis = view direction (camera forward)
    const rotationAxis = camera.getWorldDirection(new THREE.Vector3());

    this.state = {
      objectId: selectedId,
      object: obj,
      initialQuaternion: obj.quaternion.clone(),
      axis: 'view',
      rotationAxis,
      centerScreen: null, // lazy init on 1st mousemove
      initialAngle: null,
      currentAngleDeg: 0,
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

    // Attach listeners (capture phase for modal isolation)
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
      const degrees = parseFloat(this.state.numericBuffer);
      if (!isNaN(degrees) && degrees !== 0) {
        this.applyNumericRotation(degrees);
      }
    }

    // Propagate final state to multi-select
    this.propagateMultiSelect();

    this.syncTransform();
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
    this.camera = null;
  }

  cancel(): void {
    if (!this.state) return;
    const { object, initialQuaternion } = this.state;

    // Restore original rotation
    object.quaternion.copy(initialQuaternion);

    // Restore non-primary objects
    const transforms = this.host.getMultiInitialTransforms();
    for (const [id, initial] of transforms) {
      const other = this.host.getSelectables().get(id);
      if (other) {
        other.position.copy(initial.position);
        other.quaternion.copy(initial.quaternion);
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

    const { object, initialQuaternion, rotationAxis } = this.state;

    // Lazy init: project object center to screen, compute initial angle
    if (!this.state.centerScreen) {
      const worldPos = new THREE.Vector3();
      object.getWorldPosition(worldPos);
      this.state.centerScreen = this.projectToScreen(worldPos);
      const dx = e.clientX - this.state.centerScreen.x;
      const dy = e.clientY - this.state.centerScreen.y;
      this.state.initialAngle = Math.atan2(dy, dx);
      return; // 1st mousemove = calibration only
    }

    // Compute angle from center to current mouse
    const dx = e.clientX - this.state.centerScreen.x;
    const dy = e.clientY - this.state.centerScreen.y;
    const currentAngle = Math.atan2(dy, dx);
    const deltaAngle = currentAngle - this.state.initialAngle!;

    // Apply rotation from initial quaternion
    object.quaternion.copy(initialQuaternion);
    object.rotateOnWorldAxis(rotationAxis, deltaAngle);

    // Store for HUD
    this.state.currentAngleDeg = deltaAngle * (180 / Math.PI);

    // Propagate to multi-select in real-time
    this.propagateMultiSelect();

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

    // Axis constraints (toggle) — only before numeric mode
    if ((key === 'x' || key === 'y' || key === 'z') && !this.state.numericMode) {
      const newAxis = key as 'x' | 'y' | 'z';
      if (this.state.axis === newAxis) {
        // Toggle back to view axis
        this.state.axis = 'view';
        this.state.rotationAxis = this.camera!.getWorldDirection(new THREE.Vector3());
      } else {
        this.state.axis = newAxis;
        this.state.rotationAxis = new THREE.Vector3(
          newAxis === 'x' ? 1 : 0,
          newAxis === 'y' ? 1 : 0,
          newAxis === 'z' ? 1 : 0,
        );
      }
      // Reset screen projection for new axis
      this.state.centerScreen = null;
      this.state.initialAngle = null;
      // Reset rotation to initial before re-applying with new axis
      this.state.object.quaternion.copy(this.state.initialQuaternion);
      this.state.currentAngleDeg = 0;
      this.updateGuideLine();
      this.updateHud();
      return;
    }

    // Numeric input
    if (key >= '0' && key <= '9') {
      this.state.numericMode = true;
      this.state.numericBuffer += key;
      // Reset to initial rotation (numeric replaces mouse)
      this.state.object.quaternion.copy(this.state.initialQuaternion);
      this.state.currentAngleDeg = 0;
      this.updateHud();
      return;
    }
    if (key === '-') {
      this.state.numericMode = true;
      if (this.state.numericBuffer === '' || this.state.numericBuffer === '-') {
        this.state.numericBuffer = this.state.numericBuffer === '-' ? '' : '-';
      }
      this.state.object.quaternion.copy(this.state.initialQuaternion);
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

  private projectToScreen(worldPos: THREE.Vector3): { x: number; y: number } {
    const camera = this.camera!;
    const canvas = this.host.getCanvas();
    const v = worldPos.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-v.y * 0.5 + 0.5) * rect.height + rect.top,
    };
  }

  private applyNumericRotation(degrees: number): void {
    if (!this.state) return;
    const { object, initialQuaternion, rotationAxis } = this.state;
    const radians = degrees * (Math.PI / 180);
    object.quaternion.copy(initialQuaternion);
    object.rotateOnWorldAxis(rotationAxis, radians);
    this.state.currentAngleDeg = degrees;
  }

  private propagateMultiSelect(): void {
    if (!this.state) return;
    const selectedIds = this.host.getSelectedIds();
    if (selectedIds.length <= 1) return;

    const { objectId, initialQuaternion, object } = this.state;

    // Compute total rotation quaternion applied to primary object
    const totalQuat = object.quaternion.clone().multiply(initialQuaternion.clone().invert());

    const pivot = this.host.getMultiPivot();
    const transforms = this.host.getMultiInitialTransforms();

    for (const id of selectedIds) {
      if (id === objectId) continue;
      const other = this.host.getSelectables().get(id);
      if (!other) continue;
      const initial = transforms.get(id);
      if (!initial) continue;

      // Rotate position around pivot
      const offset = initial.position.clone().sub(pivot);
      offset.applyQuaternion(totalQuat);
      other.position.copy(pivot).add(offset);

      // Rotate object orientation
      other.quaternion.copy(initial.quaternion).premultiply(totalQuat);
    }
    this.host.broadcastMultiChanges();
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

    // No guide line in view mode
    if (this.state.axis === 'view') return;

    const color = AXIS_COLORS[this.state.axis] ?? 0xffffff;
    const axisVec = this.state.rotationAxis.clone();

    const origin = this.state.object.position;
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
    const { axis, numericMode, numericBuffer, currentAngleDeg } = this.state;

    const axisLabel = axis === 'view' ? '' : ` ${axis.toUpperCase()}`;

    if (numericMode) {
      const value = numericBuffer || '0';
      this.hudCallback(`R${axisLabel}: ${value}°`);
    } else {
      const deg = Math.round(currentAngleDeg * 10) / 10;
      this.hudCallback(`R${axisLabel}: ${deg}°`);
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
