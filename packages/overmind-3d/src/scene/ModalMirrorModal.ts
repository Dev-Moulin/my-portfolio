import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── Axis colors ─────────────────────────────────────────────────────────────

const AXIS_COLORS: Record<string, number> = {
  x: 0xff4444, // red
  y: 0x44ff44, // green
  z: 0x4488ff, // blue
};

// ── State ────────────────────────────────────────────────────────────────────

interface MirrorState {
  objectId: string;
  object: THREE.Object3D;
  initialScale: THREE.Vector3;
  axis: 'x' | 'y' | 'z' | null; // null = awaiting axis choice
  guideLine: THREE.Line | null;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class ModalMirrorModal {
  private host: SelectionHost;
  private state: MirrorState | null = null;

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

  enter(): boolean {
    const selectedId = this.host.getSelectedId();
    if (!selectedId || this.host.isAnyModalActive()) return false;
    const obj = this.host.getSelectables().get(selectedId);
    if (!obj) return false;

    // Detach gizmo — modal mirror replaces it
    this.host.detachGizmo();

    this.state = {
      objectId: selectedId,
      object: obj,
      initialScale: obj.scale.clone(),
      axis: null,
      guideLine: null,
    };

    // Disable camera + undo checkpoint
    this.host.fireDraggingChanged(true);

    // Capture multi-select state for propagation
    if (this.host.getSelectedIds().length > 1) {
      this.host.computeMultiPivot();
      this.host.saveMultiInitialTransforms();
    }

    // Attach listeners (capture phase for modal isolation — no mousemove needed)
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundContextMenu = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };

    window.addEventListener('mousedown', this.boundMouseDown, true);
    window.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('contextmenu', this.boundContextMenu, true);

    this.updateHud();
    return true;
  }

  confirm(): void {
    if (!this.state) return;
    this.syncTransform();
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
  }

  cancel(): void {
    if (!this.state) return;
    const { object, initialScale } = this.state;

    // Restore original scale
    object.scale.copy(initialScale);

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

    this.syncTransform();
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
  }

  // ── Private: event handlers ────────────────────────────────────────────────

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

    // Axis selection (toggle)
    if (key === 'x' || key === 'y' || key === 'z') {
      const newAxis = key as 'x' | 'y' | 'z';
      if (this.state.axis === newAxis) {
        // Toggle off → restore to initial
        this.state.axis = null;
        this.state.object.scale.copy(this.state.initialScale);
        this.restoreMulti();
      } else {
        // Apply mirror on new axis (reset first)
        this.state.object.scale.copy(this.state.initialScale);
        this.restoreMulti();
        this.state.axis = newAxis;
        this.applyMirror();
      }
      this.updateGuideLine();
      this.syncTransform();
      this.updateHud();
      return;
    }

    // Confirm / Cancel
    if (key === 'enter') { this.confirm(); return; }
    if (key === 'escape') { this.cancel(); return; }
  }

  // ── Private: mirror logic ─────────────────────────────────────────────────

  private applyMirror(): void {
    if (!this.state || !this.state.axis) return;
    const { object, initialScale, axis } = this.state;

    // Flip scale on the chosen axis
    const s = initialScale.clone();
    if (axis === 'x') s.x *= -1;
    else if (axis === 'y') s.y *= -1;
    else if (axis === 'z') s.z *= -1;
    object.scale.copy(s);

    // Propagate to multi-select
    this.propagateMultiSelect();
  }

  private propagateMultiSelect(): void {
    if (!this.state || !this.state.axis) return;
    const selectedIds = this.host.getSelectedIds();
    if (selectedIds.length <= 1) return;

    const { objectId, axis } = this.state;
    const pivot = this.host.getMultiPivot();
    const transforms = this.host.getMultiInitialTransforms();

    for (const id of selectedIds) {
      if (id === objectId) continue;
      const other = this.host.getSelectables().get(id);
      if (!other) continue;
      const initial = transforms.get(id);
      if (!initial) continue;

      // Flip position around pivot on the mirror axis
      const offset = initial.position.clone().sub(pivot);
      if (axis === 'x') offset.x *= -1;
      else if (axis === 'y') offset.y *= -1;
      else if (axis === 'z') offset.z *= -1;
      other.position.copy(pivot).add(offset);

      // Flip scale on the mirror axis
      const baseScale = initial.scale;
      if (axis === 'x') other.scale.set(-baseScale, baseScale, baseScale);
      else if (axis === 'y') other.scale.set(baseScale, -baseScale, baseScale);
      else if (axis === 'z') other.scale.set(baseScale, baseScale, -baseScale);
    }
    this.host.broadcastMultiChanges();
  }

  private restoreMulti(): void {
    const selectedIds = this.host.getSelectedIds();
    if (selectedIds.length <= 1) return;
    const transforms = this.host.getMultiInitialTransforms();
    for (const [id, initial] of transforms) {
      const other = this.host.getSelectables().get(id);
      if (other) {
        other.position.copy(initial.position);
        other.scale.setScalar(initial.scale);
      }
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

    // No guide line when no axis is chosen
    if (!this.state.axis) return;

    const color = AXIS_COLORS[this.state.axis] ?? 0xffffff;
    const axisVec = new THREE.Vector3(
      this.state.axis === 'x' ? 1 : 0,
      this.state.axis === 'y' ? 1 : 0,
      this.state.axis === 'z' ? 1 : 0,
    );

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
    const { axis } = this.state;
    if (axis) {
      this.hudCallback(`Mirror ${axis.toUpperCase()}`);
    } else {
      this.hudCallback('Mirror: X/Y/Z?');
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
