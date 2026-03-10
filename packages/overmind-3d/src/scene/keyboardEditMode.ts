import * as THREE from 'three';
import type { KeyboardDeps } from './keyboardHandler.ts';

/**
 * Edit Mode keyboard shortcuts (curve editing for now).
 * Returns true if the event was handled.
 */
export function handleEditModeKeyDown(e: KeyboardEvent, deps: KeyboardDeps): boolean {
  const {
    actors, selection, undoManager, camera, broadcastUndoState,
  } = deps;
  const { timelineActor, selectionActor } = actors;

  // E = Extrude eye path point
  if (e.key === 'e' || e.key === 'E') {
    if (!timelineActor) return false;
    e.preventDefault();
    undoManager?.recordAction(); broadcastUndoState();
    const snap = timelineActor.getSnapshot().context;
    const pts = snap.eyePath.points;
    if (pts.length === 0) return true;

    const selectedId = selection.getSelectedId();
    let srcIdx = pts.length - 1;
    if (selectedId?.startsWith('eyePath:')) {
      const idx = parseInt(selectedId.split(':')[1], 10);
      if (idx === 0 || idx === pts.length - 1) srcIdx = idx;
    }
    const src = pts[srcIdx];

    const newFrame = Math.min(snap.totalFrames,
      srcIdx === pts.length - 1 ? src.frame + 10 : Math.max(0, src.frame - 10)
    );
    const newPoint = {
      position: { x: src.position.x + 1, y: src.position.y, z: src.position.z },
      frame: newFrame,
      dwellFrames: 0,
      easing: 'smoothstep' as const,
    };

    timelineActor.send({ type: 'ADD_EYE_PATH_PT', point: newPoint });

    const newPts = timelineActor.getSnapshot().context.eyePath.points;
    const newIdx = newPts.findIndex(p =>
      p.frame === newPoint.frame &&
      Math.abs(p.position.x - newPoint.position.x) < 0.01
    );
    if (newIdx >= 0) {
      const newId = `eyePath:${newIdx}`;
      selection.select(newId);
      selectionActor?.send({ type: 'SELECT', id: newId });
      selection.enterGrab(camera);
    }

    selection.setCurveEditReferencePoint(
      new THREE.Vector3(newPoint.position.x, newPoint.position.y, newPoint.position.z)
    );
    return true;
  }

  // G = Grab control points — skip when Ctrl/Cmd held
  if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (selection.isGrabbing()) return true;
    const selectedId = selection.getSelectedId();
    if (selectedId) {
      const entered = selection.enterGrab(camera);
      if (entered) {
        selectionActor?.send({ type: 'SET_MODE', mode: 'translate' });
      }
    }
    return true;
  }

  // R = Rotate control points (skip when Ctrl/Cmd held — let browser handle refresh)
  if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (selection.isRotating()) return true;
    const selectedId = selection.getSelectedId();
    if (selectedId) {
      const entered = selection.enterRotate(camera);
      if (entered) {
        selectionActor?.send({ type: 'SET_MODE', mode: 'rotate' });
      }
    }
    return true;
  }

  // S = Scale control points — skip when Ctrl/Cmd held
  if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (selection.isCustomScaling()) return true;
    if (selection.getSelectedId()) {
      const entered = selection.enterCustomScale();
      if (entered) {
        selectionActor?.send({ type: 'SET_MODE', mode: 'scale' });
      }
    }
    return true;
  }

  // Delete / Backspace = Delete eye path point(s)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const allSelectedIds = selection.getSelectedIds();
    const eyePathIds = allSelectedIds.filter(id => id.startsWith('eyePath:'));
    if (eyePathIds.length > 0) {
      e.preventDefault();
      undoManager?.recordAction(); broadcastUndoState();
      const indices = eyePathIds
        .map(id => parseInt(id.split(':')[1], 10))
        .sort((a, b) => b - a);
      for (const idx of indices) {
        timelineActor?.send({ type: 'DELETE_EYE_PATH_PT', index: idx });
      }
      selection.deselect();
      selectionActor?.send({ type: 'DESELECT' });
      return true;
    }
    return false;
  }

  // A = Select All eye path points
  if (e.key === 'a' || e.key === 'A') {
    if (e.altKey) {
      e.preventDefault();
      selection.deselect();
      selectionActor?.send({ type: 'DESELECT' });
    } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      selection.selectAll();
      selectionActor?.send({ type: 'SET_SELECTED_IDS', ids: selection.getSelectedIds() });
    }
    return true;
  }

  // V = Handle type menu
  if (e.key === 'v' || e.key === 'V') {
    e.preventDefault();
    const selectedIds = selection.getSelectedIds();
    const eyeIds = selectedIds.filter(id =>
      id.startsWith('eyePath:') || id.startsWith('eyeHandle:')
    );
    if (eyeIds.length > 0) {
      window.dispatchEvent(new CustomEvent('overmind:handle-type-menu', {
        detail: { ids: eyeIds },
      }));
    }
    return true;
  }

  // W = Subdivide segment after selected point
  if (e.key === 'w' || e.key === 'W') {
    if (!timelineActor) return false;
    e.preventDefault();
    const selectedId = selection.getSelectedId();
    if (!selectedId?.startsWith('eyePath:')) return true;
    const segIdx = parseInt(selectedId.split(':')[1], 10);
    const pts = timelineActor.getSnapshot().context.eyePath.points;
    if (segIdx < 0 || segIdx >= pts.length - 1) return true;

    undoManager?.recordAction(); broadcastUndoState();
    timelineActor.send({ type: 'SUBDIVIDE_EYE_PATH', index: segIdx });

    const newIdx = segIdx + 1;
    const newId = `eyePath:${newIdx}`;
    selection.select(newId);
    selectionActor?.send({ type: 'SELECT', id: newId });
    selection.enterGrab(camera);

    const newPts = timelineActor.getSnapshot().context.eyePath.points;
    if (newPts[newIdx]) {
      const p = newPts[newIdx].position;
      selection.setCurveEditReferencePoint(new THREE.Vector3(p.x, p.y, p.z));
    }
    return true;
  }

  // Escape = exit edit mode (handled by the router, but also deselect here)
  if (e.key === 'Escape') {
    return false; // Let the router handle mode exit
  }

  return false;
}
