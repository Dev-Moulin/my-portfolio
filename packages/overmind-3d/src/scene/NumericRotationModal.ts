import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── State ────────────────────────────────────────────────────────────────────

interface NumericRotationState {
  objectId: string;
  object: THREE.Object3D;
  initialRotation: THREE.Euler;
  axis: 'x' | 'y' | 'z' | 'view';
  inputBuffer: string;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class NumericRotationModal {
  private host: SelectionHost;
  private state: NumericRotationState | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private hudCallback: ((text: string | null) => void) | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

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

    this.host.detachGizmo();
    this.host.fireDraggingChanged(true);

    this.state = {
      objectId: selectedId,
      object: obj,
      initialRotation: obj.rotation.clone(),
      axis: 'view',
      inputBuffer: '',
    };
    this.camera = camera;

    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    window.addEventListener('keydown', this.boundKeyDown, true);

    // Capture multi-select state
    if (this.host.getSelectedIds().length > 1) {
      this.host.computeMultiPivot();
      this.host.saveMultiInitialTransforms();
    }

    this.updateHud();
    return true;
  }

  /** Inject the first character that triggered numeric mode (not caught by modal listener) */
  appendInput(char: string): void {
    if (!this.state) return;
    if (char >= '0' && char <= '9') {
      this.state.inputBuffer += char;
    } else if (char === '-') {
      this.state.inputBuffer = this.state.inputBuffer === '-' ? '' : '-';
    }
    this.updateHud();
  }

  confirm(): void {
    if (!this.state) return;
    const { object, inputBuffer, axis } = this.state;
    const degrees = parseFloat(inputBuffer);
    if (!isNaN(degrees) && degrees !== 0) {
      const radians = degrees * (Math.PI / 180);
      // Compute axis quaternion for rotation
      const axisQuat = new THREE.Quaternion();
      if (axis === 'view' && this.camera) {
        const viewDir = this.camera.getWorldDirection(new THREE.Vector3());
        object.rotateOnWorldAxis(viewDir, radians);
        axisQuat.setFromAxisAngle(viewDir, radians);
      } else {
        const axisVec = new THREE.Vector3(
          axis === 'x' ? 1 : 0,
          axis === 'y' ? 1 : 0,
          axis === 'z' ? 1 : 0,
        );
        object.rotateOnWorldAxis(axisVec, radians);
        axisQuat.setFromAxisAngle(axisVec, radians);
      }

      // Propagate to non-primary objects around pivot
      const selectedIds = this.host.getSelectedIds();
      if (selectedIds.length > 1) {
        const selectedId = this.host.getSelectedId();
        const pivot = this.host.getMultiPivot();
        for (const id of selectedIds) {
          if (id === selectedId) continue;
          const other = this.host.getSelectables().get(id);
          if (!other) continue;
          // Rotate position around pivot
          const offset = other.position.clone().sub(pivot);
          offset.applyQuaternion(axisQuat);
          other.position.copy(pivot).add(offset);
          // Rotate object orientation
          other.quaternion.premultiply(axisQuat);
        }
        this.host.broadcastMultiChanges();
      }

      const selectedId = this.host.getSelectedId();
      if (selectedId) {
        this.host.fireObjectChange(selectedId, {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
        });
      }
    }
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
    this.camera = null;
  }

  cancel(): void {
    if (!this.state) return;
    const { object, initialRotation } = this.state;
    object.rotation.copy(initialRotation);

    // Restore non-primary objects
    const transforms = this.host.getMultiInitialTransforms();
    for (const [id, initial] of transforms) {
      const other = this.host.getSelectables().get(id);
      if (other) {
        other.position.copy(initial.position);
        other.quaternion.copy(initial.quaternion);
        other.scale.setScalar(initial.scale);
      }
    }
    transforms.clear();
    if (this.host.getSelectedIds().length > 1) this.host.broadcastMultiChanges();

    const selectedId = this.host.getSelectedId();
    if (selectedId) {
      this.host.fireObjectChange(selectedId, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone(),
      });
    }
    this.cleanup();
    this.host.fireDraggingChanged(false);
    this.state = null;
    this.camera = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.state) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const key = e.key;

    // Axis constraint (only before digits)
    if ((key === 'x' || key === 'X') && this.state.inputBuffer === '') {
      this.state.axis = 'x'; this.updateHud(); return;
    }
    if ((key === 'y' || key === 'Y') && this.state.inputBuffer === '') {
      this.state.axis = 'y'; this.updateHud(); return;
    }
    if ((key === 'z' || key === 'Z') && this.state.inputBuffer === '') {
      this.state.axis = 'z'; this.updateHud(); return;
    }

    // Digits
    if (key >= '0' && key <= '9') {
      this.state.inputBuffer += key; this.updateHud(); return;
    }
    // Minus sign (toggle)
    if (key === '-' && (this.state.inputBuffer === '' || this.state.inputBuffer === '-')) {
      this.state.inputBuffer = this.state.inputBuffer === '-' ? '' : '-';
      this.updateHud(); return;
    }
    // Decimal point
    if (key === '.' && !this.state.inputBuffer.includes('.')) {
      this.state.inputBuffer += '.'; this.updateHud(); return;
    }
    // Backspace
    if (key === 'Backspace') {
      this.state.inputBuffer = this.state.inputBuffer.slice(0, -1);
      this.updateHud(); return;
    }
    // Confirm / Cancel
    if (key === 'Enter') { this.confirm(); return; }
    if (key === 'Escape') { this.cancel(); return; }
  }

  private updateHud(): void {
    if (!this.state || !this.hudCallback) return;
    const { axis, inputBuffer } = this.state;
    const axisLabel = axis === 'view' ? '' : ` ${axis.toUpperCase()}`;
    const value = inputBuffer || '0';
    this.hudCallback(`R${axisLabel}: ${value}°`);
  }

  private cleanup(): void {
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown, true);
      this.boundKeyDown = null;
    }
    this.hudCallback?.(null);
  }
}
