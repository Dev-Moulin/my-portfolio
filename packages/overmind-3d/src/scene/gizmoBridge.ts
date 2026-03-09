import type CameraControls from 'camera-controls';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry } from './componentRegistry.ts';
import type { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import type { CardSystem } from './cardSystem.ts';
import type { EyePathSystem } from './eyePathSystem.ts';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { SceneActors, SceneMutableState, Disposable } from './sceneContext.ts';
import { enforceAlignedConstraint } from '../machines/timeline/compute.ts';

export interface GizmoBridgeDeps {
  actors: SceneActors;
  selection: SelectionSystem;
  componentRegistry: ComponentRegistry;
  undoManager: UndoRedoManager | null;
  cardSystem: CardSystem;
  eyePathSystem: EyePathSystem | null;
  cameraControls: CameraControls;
  rotHud: HTMLDivElement;
  state: SceneMutableState;
  captureElementKeyframe: () => void;
  broadcastUndoState: () => void;
  setCardPortals: React.Dispatch<React.SetStateAction<Map<string, HTMLDivElement>>>;
}

export function setupGizmoBridge(deps: GizmoBridgeDeps): Disposable {
  const {
    actors, selection, componentRegistry, undoManager, cardSystem, eyePathSystem,
    cameraControls, rotHud, state,
    captureElementKeyframe, broadcastUndoState, setCardPortals,
  } = deps;
  const { selectionActor, modelActor, neonBandsActor, lightingActor, timelineActor } = actors;

  // 4b. Gizmo → XState sync (position + rotation + scale)
  selection.onObjectChange((id, data) => {
    // Eye path handle drag
    if (eyePathSystem?.ownsHandleId(id)) {
      const info = eyePathSystem.getHandleInfoFromId(id);
      if (info && timelineActor) {
        const ctx = timelineActor.getSnapshot().context;
        const pt = ctx.eyePath.points[info.pointIndex];
        if (pt) {
          const newPos = { x: data.position.x, y: data.position.y, z: data.position.z };
          const updatedPoint = { ...pt };
          if (info.handleSide === 'in') {
            updatedPoint.handleIn = newPos;
          } else {
            updatedPoint.handleOut = newPos;
          }
          // Auto → Aligned promotion
          if ((updatedPoint.handleType ?? 'auto') === 'auto') {
            updatedPoint.handleType = 'aligned';
          }
          // Aligned constraint enforcement
          if (updatedPoint.handleType === 'aligned') {
            enforceAlignedConstraint(updatedPoint, info.handleSide);
          }
          timelineActor.send({
            type: 'UPDATE_EYE_PATH_PT',
            index: info.pointIndex,
            point: updatedPoint,
          });
        }
      }
      return;
    }

    // Eye path control points — translate handles along with point
    if (eyePathSystem?.ownsControlPointId(id)) {
      const idx = eyePathSystem.getPointIndexFromId(id);
      if (idx !== null && timelineActor) {
        const ctx = timelineActor.getSnapshot().context;
        const pt = ctx.eyePath.points[idx];
        if (pt) {
          const newPos = { x: data.position.x, y: data.position.y, z: data.position.z };
          const dx = newPos.x - pt.position.x;
          const dy = newPos.y - pt.position.y;
          const dz = newPos.z - pt.position.z;
          const updatedPoint = { ...pt, position: newPos };
          if (pt.handleIn) {
            updatedPoint.handleIn = { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy, z: pt.handleIn.z + dz };
          }
          if (pt.handleOut) {
            updatedPoint.handleOut = { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy, z: pt.handleOut.z + dz };
          }
          timelineActor.send({ type: 'UPDATE_EYE_PATH_PT', index: idx, point: updatedPoint });
        }
      }
      return;
    }

    // Duplicated instances — delegate to descriptor via registry
    if (componentRegistry.has(id)) {
      componentRegistry.syncFromTransform(id, {
        position: data.position,
        rotation: data.rotation,
        scale: data.scale,
      });
      const inst = componentRegistry.get(id)!;
      window.dispatchEvent(new CustomEvent('overmind:instance-config', {
        detail: { id: inst.id, type: inst.type, config: inst.config },
      }));
      return;
    }

    // Original objects
    switch (id) {
      case 'model':
        modelActor?.send({ type: 'SET_POSITION', x: data.position.x, y: data.position.y, z: data.position.z });
        modelActor?.send({ type: 'SET_BASE_ROTATION_Y', value: data.rotation.y });
        modelActor?.send({ type: 'SET_SCALE', scale: data.scale.x });
        break;
      case 'neon':
        neonBandsActor?.send({ type: 'UPDATE_POSITION_X', x: data.position.x });
        neonBandsActor?.send({ type: 'UPDATE_POSITION_Y', y: data.position.y });
        neonBandsActor?.send({ type: 'UPDATE_POSITION_Z', z: data.position.z });
        neonBandsActor?.send({ type: 'UPDATE_SCALE', scale: data.scale.x });
        break;
      case 'dirLight':
        lightingActor?.send({ type: 'UPDATE_DIRECTIONAL_POSITION', position: { x: data.position.x, y: data.position.y, z: data.position.z } });
        break;
      case 'pointLight':
        lightingActor?.send({ type: 'UPDATE_POINT_POSITION', position: { x: data.position.x, y: data.position.y, z: data.position.z } });
        break;
      case 'card':
        cardSystem.syncProxyToCSS3D();
        break;
    }
  });

  // Curve edit mode: click on empty space → add eye path point
  selection.onEmptyClick((pos) => {
    if (!timelineActor) return;
    const snap = timelineActor.getSnapshot().context;

    const newPoint = {
      position: {
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100,
        z: Math.round(pos.z * 100) / 100,
      },
      frame: Math.round(snap.currentFrame),
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
      selection.select(`eyePath:${newIdx}`);
      selectionActor?.send({ type: 'SELECT', id: `eyePath:${newIdx}` });
    }

    selection.setCurveEditReferencePoint(pos);
  });

  // 4b-bis. Multi-object change callback
  selection.onMultiObjectChange((changes) => {
    for (const { id, data } of changes) {
      // Eye path handle drag (multi)
      if (eyePathSystem?.ownsHandleId(id)) {
        const info = eyePathSystem.getHandleInfoFromId(id);
        if (info && timelineActor) {
          const ctx = timelineActor.getSnapshot().context;
          const pt = ctx.eyePath.points[info.pointIndex];
          if (pt) {
            const newPos = { x: data.position.x, y: data.position.y, z: data.position.z };
            const updatedPoint = { ...pt };
            if (info.handleSide === 'in') updatedPoint.handleIn = newPos;
            else updatedPoint.handleOut = newPos;
            if ((updatedPoint.handleType ?? 'auto') === 'auto') updatedPoint.handleType = 'aligned';
            if (updatedPoint.handleType === 'aligned') enforceAlignedConstraint(updatedPoint, info.handleSide);
            timelineActor.send({ type: 'UPDATE_EYE_PATH_PT', index: info.pointIndex, point: updatedPoint });
          }
        }
        continue;
      }
      // Eye path control points (multi) — translate handles
      if (eyePathSystem?.ownsControlPointId(id)) {
        const idx = eyePathSystem.getPointIndexFromId(id);
        if (idx !== null && timelineActor) {
          const ctx = timelineActor.getSnapshot().context;
          const pt = ctx.eyePath.points[idx];
          if (pt) {
            const newPos = { x: data.position.x, y: data.position.y, z: data.position.z };
            const dx = newPos.x - pt.position.x, dy = newPos.y - pt.position.y, dz = newPos.z - pt.position.z;
            const updatedPoint = { ...pt, position: newPos };
            if (pt.handleIn) updatedPoint.handleIn = { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy, z: pt.handleIn.z + dz };
            if (pt.handleOut) updatedPoint.handleOut = { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy, z: pt.handleOut.z + dz };
            timelineActor.send({ type: 'UPDATE_EYE_PATH_PT', index: idx, point: updatedPoint });
          }
        }
        continue;
      }
      if (componentRegistry.has(id)) {
        componentRegistry.syncFromTransform(id, {
          position: data.position,
          rotation: data.rotation,
          scale: data.scale,
        });
        continue;
      }
      switch (id) {
        case 'model':
          modelActor?.send({ type: 'SET_POSITION', x: data.position.x, y: data.position.y, z: data.position.z });
          modelActor?.send({ type: 'SET_SCALE', scale: data.scale.x });
          break;
        case 'neon':
          neonBandsActor?.send({ type: 'UPDATE_POSITION_X', x: data.position.x });
          neonBandsActor?.send({ type: 'UPDATE_POSITION_Y', y: data.position.y });
          neonBandsActor?.send({ type: 'UPDATE_POSITION_Z', z: data.position.z });
          neonBandsActor?.send({ type: 'UPDATE_SCALE', scale: data.scale.x });
          break;
        case 'dirLight':
          lightingActor?.send({ type: 'UPDATE_DIRECTIONAL_POSITION', position: { x: data.position.x, y: data.position.y, z: data.position.z } });
          break;
        case 'pointLight':
          lightingActor?.send({ type: 'UPDATE_POINT_POSITION', position: { x: data.position.x, y: data.position.y, z: data.position.z } });
          break;
        case 'card':
          cardSystem.syncProxyToCSS3D();
          break;
      }
    }
  });

  // 4c. Bridge SelectionSystem → selectionActor (for DevPanel)
  selection.onSelectionChange((primaryId, selectedIds) => {
    if (selectedIds.length > 0) {
      selectionActor?.send({ type: 'SET_SELECTED_IDS', ids: selectedIds });
      if (selectedIds.includes('card')) cardSystem.setInteractive(false);
      else cardSystem.setInteractive(true);
      for (const inst of componentRegistry.getByType('card')) {
        (inst.extra as CardExtra).system.setInteractive(!selectedIds.includes(inst.id));
      }
      if (primaryId && componentRegistry.has(primaryId)) {
        const inst = componentRegistry.get(primaryId)!;
        window.dispatchEvent(new CustomEvent('overmind:instance-config', {
          detail: { id: inst.id, type: inst.type, config: inst.config },
        }));
      } else {
        window.dispatchEvent(new CustomEvent('overmind:instance-config', { detail: null }));
      }
      // Multi-instance config for Properties Panel
      const allConfigs = selectedIds
        .filter(id => componentRegistry.has(id))
        .map(id => {
          const ci = componentRegistry.get(id)!;
          return { id: ci.id, type: ci.type, config: { ...(ci.config as object) } };
        });
      window.dispatchEvent(new CustomEvent('overmind:multi-instance-config', {
        detail: allConfigs.length > 0 ? allConfigs : null,
      }));
    } else {
      cardSystem.setInteractive(true);
      for (const inst of componentRegistry.getByType('card')) {
        (inst.extra as CardExtra).system.setInteractive(true);
      }
      selectionActor?.send({ type: 'DESELECT' });
      window.dispatchEvent(new CustomEvent('overmind:instance-config', { detail: null }));
      window.dispatchEvent(new CustomEvent('overmind:multi-instance-config', { detail: null }));
    }
  });

  // 4d. Disable camera controls while dragging gizmo + record undo on drag start
  selection.onDraggingChanged((dragging) => {
    if (dragging) { undoManager?.recordAction(); broadcastUndoState(); }
    if (!dragging) {
      captureElementKeyframe();
    }
    cameraControls.enabled = state.freeCameraActive ? !dragging : false;
  });

  // Rotation HUD callback
  selection.onRotationHud((rotation) => {
    if (!rotation) {
      rotHud.style.display = 'none';
      return;
    }
    const toDeg = 180 / Math.PI;
    const x = (rotation.x * toDeg).toFixed(1);
    const y = (rotation.y * toDeg).toFixed(1);
    const z = (rotation.z * toDeg).toFixed(1);
    rotHud.textContent = `R: ${x}\u00b0  ${y}\u00b0  ${z}\u00b0`;
    rotHud.style.display = 'block';
  });

  // Rotate modal HUD callback (reuses same rotHud element — only one modal active at a time)
  selection.onRotateHud((text) => {
    if (!text) {
      rotHud.style.display = 'none';
      return;
    }
    rotHud.textContent = text;
    rotHud.style.display = 'block';
  });

  // Grab modal HUD callback (reuses same rotHud element — only one modal active at a time)
  selection.onGrabHud((text) => {
    if (!text) {
      rotHud.style.display = 'none';
      return;
    }
    rotHud.textContent = text;
    rotHud.style.display = 'block';
  });

  // Mirror modal HUD callback (reuses same rotHud element — only one modal active at a time)
  selection.onMirrorHud((text) => {
    if (!text) {
      rotHud.style.display = 'none';
      return;
    }
    rotHud.textContent = text;
    rotHud.style.display = 'block';
  });

  // Box select HUD callback (reuses same rotHud element — only one modal active at a time)
  selection.onBoxSelectHud((text) => {
    if (!text) {
      rotHud.style.display = 'none';
      return;
    }
    rotHud.textContent = text;
    rotHud.style.display = 'block';
  });

  // Lasso select HUD callback (reuses same rotHud element)
  selection.onLassoSelectHud((text) => {
    if (!text) {
      rotHud.style.display = 'none';
      return;
    }
    rotHud.textContent = text;
    rotHud.style.display = 'block';
  });

  // 4e-bis. Card CSS3D pointer event → bridge to SelectionSystem
  const cardEl = cardSystem.getPortalTarget();
  let cardPointerDown: { x: number; y: number } | null = null;

  function onCardPointerDown(e: PointerEvent) {
    if (selection.isCustomScaling() || selection.isGrabbing() || selection.isRotating() || selection.isMirroring() || selection.isBoxSelecting() || selection.isLassoSelecting()) return;
    cardPointerDown = { x: e.clientX, y: e.clientY };
  }

  function onCardPointerUp(e: PointerEvent) {
    if (!cardPointerDown) return;
    const dx = e.clientX - cardPointerDown.x;
    const dy = e.clientY - cardPointerDown.y;
    cardPointerDown = null;
    if (Math.sqrt(dx * dx + dy * dy) >= 3) return;

    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, select')) return;

    selection.trySelectAt(e.clientX, e.clientY, e.ctrlKey);
  }

  cardEl.addEventListener('pointerdown', onCardPointerDown);
  cardEl.addEventListener('pointerup', onCardPointerUp);

  // 4e. Outliner → SceneRenderer: select from outliner
  function onOutlinerSelect(e: Event) {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    selection.select(id);
    selection.attachGizmo();
  }
  window.addEventListener('overmind:outliner-select', onOutlinerSelect);

  // 4e-ter. Card portal events from UndoRedoManager
  function onCardPortalAdd(e: Event) {
    const { id, portalTarget } = (e as CustomEvent<{ id: string; portalTarget: HTMLDivElement }>).detail;
    setCardPortals(prev => new Map(prev).set(id, portalTarget));
  }
  function onCardPortalRemove(e: Event) {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    setCardPortals(prev => { const m = new Map(prev); m.delete(id); return m; });
  }
  window.addEventListener('overmind:card-portal-add', onCardPortalAdd);
  window.addEventListener('overmind:card-portal-remove', onCardPortalRemove);

  // 4f. Visibility bridge: selectionActor → SelectionSystem
  let prevVisibility: Record<string, boolean> = {};
  const visibilitySub = selectionActor?.subscribe((snapshot: { context: { visibility: Record<string, boolean> } }) => {
    const vis = snapshot.context.visibility;
    for (const [id, visible] of Object.entries(vis)) {
      if (prevVisibility[id] !== visible) {
        selection.setObjectVisible(id, visible);
      }
    }
    prevVisibility = { ...vis };
  });

  // 4g. Locked bridge: selectionActor → SelectionSystem
  let prevLocked: Record<string, boolean> = {};
  const lockedSub = selectionActor?.subscribe((snapshot: { context: { locked: Record<string, boolean> } }) => {
    const lck = snapshot.context.locked;
    for (const [id, locked] of Object.entries(lck)) {
      if (prevLocked[id] !== locked) {
        selection.setObjectLocked(id, locked);
      }
    }
    prevLocked = { ...lck };
  });

  return {
    dispose() {
      cardEl.removeEventListener('pointerdown', onCardPointerDown);
      cardEl.removeEventListener('pointerup', onCardPointerUp);
      window.removeEventListener('overmind:outliner-select', onOutlinerSelect);
      window.removeEventListener('overmind:card-portal-add', onCardPortalAdd);
      window.removeEventListener('overmind:card-portal-remove', onCardPortalRemove);
      visibilitySub?.unsubscribe();
      lockedSub?.unsubscribe();
    },
  };
}
