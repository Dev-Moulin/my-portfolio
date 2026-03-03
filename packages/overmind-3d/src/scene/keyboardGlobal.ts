import CameraControls from 'camera-controls';
import type { KeyboardDeps } from './keyboardHandler.ts';

/**
 * Global keyboard shortcuts — active in ALL modes.
 * Returns true if the event was handled.
 */
export function handleGlobalKeyDown(e: KeyboardEvent, deps: KeyboardDeps): boolean {
  const { cameraControls, selection, undoManager, toggleCameraMode, broadcastUndoState } = deps;

  // Shift+MMB pan: switch middle button to TRUCK while Shift is held
  if (e.key === 'Shift' && !selection.isDragging()) {
    cameraControls.mouseButtons.middle = CameraControls.ACTION.TRUCK;
  }

  // Rotation snap modifiers (Ctrl/Shift during rotate drag)
  if ((e.key === 'Control' || e.key === 'Shift') && selection.isDragging() && selection.getMode() === 'rotate') {
    const DEG5 = 5 * Math.PI / 180;
    const DEG1 = 1 * Math.PI / 180;
    if (e.ctrlKey && e.shiftKey) {
      selection.setRotationSnap(DEG1);
    } else if (e.ctrlKey) {
      selection.setRotationSnap(DEG5);
    }
  }

  // Ctrl+Z / Ctrl+Shift+Z = Undo / Redo
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (e.shiftKey) undoManager?.redo();
    else undoManager?.undo();
    broadcastUndoState();
    return true;
  }

  // F = Toggle camera mode (free ↔ scroll)
  if (e.key === 'f' || e.key === 'F') {
    toggleCameraMode();
    return true;
  }

  // Ctrl+S = Save scene
  if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('overmind:scene-save-trigger'));
    return true;
  }

  // Escape = cancel active operation
  if (e.key === 'Escape') {
    if (selection.isGrabbing()) {
      selection.cancelGrab();
    } else if (selection.isRotating()) {
      selection.cancelRotate();
    } else if (selection.isCustomScaling()) {
      selection.cancelCustomScale();
    } else if (selection.isMirroring()) {
      selection.cancelMirror();
    } else if (selection.isBoxSelecting()) {
      selection.cancelBoxSelect();
    } else if (selection.isLassoSelecting()) {
      selection.cancelLassoSelect();
    } else {
      return false; // Not handled — let mode-specific handler deal with it
    }
    return true;
  }

  return false;
}

/**
 * Global key-up handler — active in ALL modes.
 */
export function handleGlobalKeyUp(e: KeyboardEvent, deps: KeyboardDeps): void {
  const { selection, cameraControls } = deps;

  if (e.key === 'Control' || e.key === 'Shift') {
    selection.setRotationSnap(null);
  }
  // Restore MMB = orbit when Shift released
  if (e.key === 'Shift') {
    cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE;
  }
}
