import * as THREE from 'three';
import CameraControls from 'camera-controls';
import type { ActorRefFrom } from 'xstate';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry } from './componentRegistry.ts';
import type { ComponentContext } from './componentDescriptor.ts';
import type { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import type { CardSystem } from './cardSystem.ts';
import type { SceneActors, SceneMutableState, Disposable } from './sceneContext.ts';
import type { interactionModeMachine } from '../machines/interactionModeMachine.ts';
import { handleGlobalKeyDown, handleGlobalKeyUp } from './keyboardGlobal.ts';
import { handleObjectModeKeyDown } from './keyboardObjectMode.ts';
import { handleEditModeKeyDown } from './keyboardEditMode.ts';

export interface KeyboardDeps {
  actors: SceneActors;
  selection: SelectionSystem;
  componentRegistry: ComponentRegistry;
  componentCtx: ComponentContext;
  undoManager: UndoRedoManager | null;
  cardSystem: CardSystem;
  cameraControls: CameraControls;
  camera: THREE.PerspectiveCamera;
  state: SceneMutableState;
  basePath: string;
  setCardPortals: React.Dispatch<React.SetStateAction<Map<string, HTMLDivElement>>>;
  toggleCameraMode: () => void;
  captureKeyframe: () => void;
  insertInterpolatedKeyframe: () => void;
  captureElementKeyframe: () => void;
  broadcastUndoState: () => void;
  interactionModeActor: ActorRefFrom<typeof interactionModeMachine> | null | undefined;
}

export function setupKeyboardHandlers(deps: KeyboardDeps): Disposable {
  const { actors, selection, interactionModeActor } = deps;
  const { selectionActor, timelineActor } = actors;

  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Tab = Toggle Object ↔ Edit mode
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!interactionModeActor) return;
      const snap = interactionModeActor.getSnapshot();
      if (snap.value === 'edit') {
        // Exit edit mode → object mode
        interactionModeActor.send({ type: 'ENTER_OBJECT_MODE' });
        selection.setCurveEditMode(false);
        selectionActor?.send({ type: 'SET_CURVE_EDIT', active: false });
      } else {
        // Enter edit mode — default to curve if eye path has points
        const pts = timelineActor?.getSnapshot().context.eyePath.points;
        if (pts && pts.length > 0) {
          interactionModeActor.send({ type: 'ENTER_EDIT_MODE', targetType: 'curve' });
          selection.setCurveEditMode(true);
          selectionActor?.send({ type: 'SET_CURVE_EDIT', active: true });
          const last = pts[pts.length - 1];
          selection.setCurveEditReferencePoint(
            new THREE.Vector3(last.position.x, last.position.y, last.position.z)
          );
        }
      }
      return;
    }

    // Shift+C = Enter/exit curve edit mode (legacy shortcut, kept for compat)
    if (e.key === 'C' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (!interactionModeActor) return;
      const snap = interactionModeActor.getSnapshot();
      if (snap.value === 'edit') {
        // Exit edit mode
        interactionModeActor.send({ type: 'ENTER_OBJECT_MODE' });
        selection.setCurveEditMode(false);
        selectionActor?.send({ type: 'SET_CURVE_EDIT', active: false });
      } else {
        // Enter curve edit mode
        const pts = timelineActor?.getSnapshot().context.eyePath.points;
        if (pts && pts.length > 0) {
          interactionModeActor.send({ type: 'ENTER_EDIT_MODE', targetType: 'curve' });
          selection.setCurveEditMode(true);
          selectionActor?.send({ type: 'SET_CURVE_EDIT', active: true });
          const last = pts[pts.length - 1];
          selection.setCurveEditReferencePoint(
            new THREE.Vector3(last.position.x, last.position.y, last.position.z)
          );
        }
      }
      return;
    }

    // Escape in edit mode = exit to object mode
    if (e.key === 'Escape') {
      const mode = interactionModeActor?.getSnapshot()?.value ?? 'object';
      if (mode === 'edit') {
        interactionModeActor?.send({ type: 'ENTER_OBJECT_MODE' });
        selection.setCurveEditMode(false);
        selectionActor?.send({ type: 'SET_CURVE_EDIT', active: false });
        return;
      }
      // Fall through to global Escape handler for cancel operations
    }

    // 1. Global handlers (all modes)
    if (handleGlobalKeyDown(e, deps)) return;

    // 2. Mode-specific handlers
    const mode = interactionModeActor?.getSnapshot()?.value ?? 'object';
    switch (mode) {
      case 'object':
        handleObjectModeKeyDown(e, deps);
        break;
      case 'edit':
        handleEditModeKeyDown(e, deps);
        break;
      case 'preview':
        // No shortcuts in preview mode for now
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    handleGlobalKeyUp(e, deps);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
