import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── State ────────────────────────────────────────────────────────────────────

interface CustomScaleState {
  objectId: string;
  object: THREE.Object3D;
  initialScale: number;
  centerScreen: THREE.Vector2 | null;  // null = lazy init on 1st mousemove
  initialDistance: number;
  guideLine: THREE.Line;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class CustomScaleModal {
  private host: SelectionHost;
  private state: CustomScaleState | null = null;
  private initialPrimaryScale = 1;
  private boundMove: ((e: MouseEvent) => void) | null = null;
  private boundBlur: (() => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(host: SelectionHost) {
    this.host = host;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  isActive(): boolean {
    return this.state !== null;
  }

  enter(): boolean {
    const selectedId = this.host.getSelectedId();
    if (!selectedId || this.host.isAnyModalActive()) return false;
    const obj = this.host.getSelectables().get(selectedId);
    if (!obj) return false;

    // Detach TransformControls gizmo — custom scale replaces it
    this.host.detachGizmo();

    const initialScale = obj.scale.x;

    // Guide line
    const guideLine = this.createGuideLine();
    this.host.getScene().add(guideLine);

    this.state = {
      objectId: selectedId,
      object: obj,
      initialScale,
      centerScreen: null,  // lazy init on 1st mousemove
      initialDistance: 1,   // placeholder
      guideLine,
    };

    // Disable camera + undo checkpoint
    this.host.fireDraggingChanged(true);

    // Capture multi-select state for propagation
    if (this.host.getSelectedIds().length > 1) {
      this.initialPrimaryScale = initialScale;
      this.host.computeMultiPivot();
      this.host.saveMultiInitialTransforms();
    }

    // Attach listeners (modal: mousedown + keydown in capture phase)
    this.boundMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundBlur = () => this.cancel();
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

    window.addEventListener('mousemove', this.boundMove);
    window.addEventListener('blur', this.boundBlur);
    window.addEventListener('mousedown', this.boundMouseDown, true);
    window.addEventListener('keydown', this.boundKeyDown, true);

    return true;
  }

  confirm(): void {
    if (!this.state) return;
    this.cleanup();
    // Fire dragging end → captureElementKeyframe() + re-enable camera
    this.host.fireDraggingChanged(false);
    this.state = null;
  }

  cancel(): void {
    if (!this.state) return;
    const { object, initialScale } = this.state;

    // Restore original scale
    object.scale.setScalar(initialScale);

    // Restore non-primary objects
    const transforms = this.host.getMultiInitialTransforms();
    for (const [id, initial] of transforms) {
      const other = this.host.getSelectables().get(id);
      if (other) {
        other.position.copy(initial.position);
        other.scale.setScalar(initial.scale);
      }
    }
    transforms.clear();
    if (this.host.getSelectedIds().length > 1) this.host.broadcastMultiChanges();

    // Sync actors with restored scale
    const selectedId = this.host.getSelectedId();
    if (selectedId) {
      this.host.fireObjectChange(selectedId, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone(),
      });
    }

    this.cleanup();
    // Fire dragging end
    this.host.fireDraggingChanged(false);
    this.state = null;
  }

  // ── Private: event handlers ────────────────────────────────────────────────

  private onMouseMove(e: MouseEvent): void {
    if (!this.state) return;
    const { object, initialScale } = this.state;

    // Lazy init: compute centerScreen + initialDistance on 1st mousemove
    if (!this.state.centerScreen) {
      const worldPos = new THREE.Vector3();
      object.getWorldPosition(worldPos);
      this.state.centerScreen = this.projectToScreen(worldPos);
      this.state.initialDistance = Math.max(5, Math.hypot(
        e.clientX - this.state.centerScreen.x,
        e.clientY - this.state.centerScreen.y,
      ));
      return; // 1st mousemove = calibration only
    }

    const { centerScreen, initialDistance } = this.state;
    const currentDistance = Math.hypot(
      e.clientX - centerScreen.x,
      e.clientY - centerScreen.y,
    );

    const ratio = currentDistance / initialDistance;
    const newScale = Math.max(0.01, initialScale * ratio);
    object.scale.setScalar(newScale);

    // Propagate to non-primary objects around pivot
    const selectedIds = this.host.getSelectedIds();
    if (selectedIds.length > 1) {
      const scaleRatio = newScale / this.initialPrimaryScale;
      if (isFinite(scaleRatio)) {
        const pivot = this.host.getMultiPivot();
        const transforms = this.host.getMultiInitialTransforms();
        for (const id of selectedIds) {
          if (id === this.state!.objectId) continue;
          const other = this.host.getSelectables().get(id);
          if (!other) continue;
          const initial = transforms.get(id);
          if (!initial) continue;
          const offset = initial.position.clone().sub(pivot);
          offset.multiplyScalar(scaleRatio);
          other.position.copy(pivot).add(offset);
          other.scale.setScalar(initial.scale * scaleRatio);
        }
        this.host.broadcastMultiChanges();
      }
    }

    // Sync actors via the same callback as TransformControls objectChange
    const selectedId = this.host.getSelectedId();
    if (selectedId) {
      this.host.fireObjectChange(selectedId, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone(),
      });
    }

    this.updateGuideLine(e.clientX, e.clientY);
  }

  // Modal handlers (capture phase — intercept before CameraControls/Selection)

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
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.confirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.cancel();
    }
  }

  // ── Private: helpers ───────────────────────────────────────────────────────

  private projectToScreen(worldPos: THREE.Vector3): THREE.Vector2 {
    const camera = this.host.getCamera();
    const canvas = this.host.getCanvas();
    const v = worldPos.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      (v.x * 0.5 + 0.5) * rect.width + rect.left,
      (-v.y * 0.5 + 0.5) * rect.height + rect.top,
    );
  }

  private createGuideLine(): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0xffcc00,
      depthTest: false,
      transparent: true,
      opacity: 0.6,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 9999;
    line.frustumCulled = false;
    return line;
  }

  private updateGuideLine(clientX: number, clientY: number): void {
    if (!this.state?.guideLine || !this.state.object) return;

    const start = new THREE.Vector3();
    this.state.object.getWorldPosition(start);

    // Unproject mouse to a plane at object's depth
    const camera = this.host.getCamera();
    const canvas = this.host.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const camPos = camera.position.clone();
    const mouseWorld = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = mouseWorld.sub(camPos).normalize();
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const objDepth = start.clone().sub(camPos).dot(camDir);
    const t = objDepth / dir.dot(camDir);
    const end = camPos.clone().add(dir.multiplyScalar(t));

    const positions = this.state.guideLine.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
  }

  private cleanup(): void {
    if (!this.state) return;
    // Remove guide line
    this.host.getScene().remove(this.state.guideLine);
    this.state.guideLine.geometry.dispose();
    (this.state.guideLine.material as THREE.Material).dispose();
    // Remove all listeners
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
  }
}
