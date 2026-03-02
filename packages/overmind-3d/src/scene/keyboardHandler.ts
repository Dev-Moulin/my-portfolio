import * as THREE from 'three';
import type CameraControls from 'camera-controls';
import type * as YUKA from 'yuka';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry } from './componentRegistry.ts';
import type { ComponentContext } from './componentDescriptor.ts';
import type { NeonInstanceConfig } from './instanceRegistry.ts';
import type { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import type { CardSystem } from './cardSystem.ts';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { SceneActors, SceneMutableState, Disposable } from './sceneContext.ts';
import { getFontPath } from '../utils/dracoPath.ts';

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
  yukaVehicle: YUKA.Vehicle;
  setCardPortals: React.Dispatch<React.SetStateAction<Map<string, HTMLDivElement>>>;
  toggleCameraMode: () => void;
  captureKeyframe: () => void;
  insertInterpolatedKeyframe: () => void;
  captureElementKeyframe: () => void;
  broadcastUndoState: () => void;
}

export function setupKeyboardHandlers(deps: KeyboardDeps): Disposable {
  const {
    actors, selection, componentRegistry, componentCtx, undoManager, cardSystem,
    cameraControls, camera, state, basePath,
    yukaVehicle, setCardPortals,
    toggleCameraMode, captureKeyframe, insertInterpolatedKeyframe,
    captureElementKeyframe, broadcastUndoState,
  } = deps;
  const { timelineActor, selectionActor, neonBandsActor } = actors;

  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
      return;
    }
    if (e.key === 'f' || e.key === 'F') toggleCameraMode();
    // I shortcut: selected object(s) → element KF, free mode → camera KF, scroll mode → interpolated camera KF
    if (e.key === 'i' || e.key === 'I') {
      undoManager?.recordAction(); broadcastUndoState();
      if (selection.getSelectedCount() > 0) {
        captureElementKeyframe();
      } else if (state.freeCameraActive) {
        captureKeyframe();
      } else {
        insertInterpolatedKeyframe();
      }
    }
    // Gizmo shortcuts
    if (e.key === 'g' || e.key === 'G') {
      if (selection.getSelectedId()) {
        selection.setMode('translate'); selection.attachGizmo();
        selectionActor?.send({ type: 'SET_MODE', mode: 'translate' });
      }
    }
    if (e.key === 'r' || e.key === 'R') {
      if (selection.getSelectedId()) {
        selection.setMode('rotate'); selection.attachGizmo();
        selectionActor?.send({ type: 'SET_MODE', mode: 'rotate' });
      }
    }
    // Ctrl+S = Save scene
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('overmind:scene-save-trigger'));
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      if (selection.isCustomScaling()) return;
      if (selection.getSelectedId()) {
        const entered = selection.enterCustomScale();
        if (entered) {
          selectionActor?.send({ type: 'SET_MODE', mode: 'scale' });
        }
      }
      return;
    }
    if (e.key === 'Escape') {
      if (selection.isNumericRotating()) {
        selection.cancelNumericRotation();
      } else if (selection.isCustomScaling()) {
        selection.cancelCustomScale();
      } else {
        selection.detachGizmo();
      }
    }
    // Alt+H = Toggle visibility of selected object
    if ((e.key === 'h' || e.key === 'H') && e.altKey) {
      e.preventDefault();
      const sel = selection.getSelectedId();
      if (sel) {
        selectionActor?.send({ type: 'TOGGLE_VISIBILITY', id: sel });
      } else {
        selectionActor?.send({ type: 'SHOW_ALL' });
      }
      return;
    }
    // Numeric rotation: digit or minus while in rotate mode (no drag, no other modal)
    if (
      !selection.isDragging() &&
      !selection.isCustomScaling() &&
      !selection.isNumericRotating() &&
      selection.getMode() === 'rotate' &&
      selection.getSelectedId() &&
      ((e.key >= '0' && e.key <= '9') || e.key === '-')
    ) {
      e.preventDefault();
      selection.enterNumericRotation(camera);
      selection.appendNumericInput(e.key);
      return;
    }

    // E = capture eye waypoint at current Yuka vehicle position
    if (e.key === 'e' || e.key === 'E') {
      if (timelineActor) {
        e.preventDefault();
        undoManager?.recordAction(); broadcastUndoState();
        const pos = yukaVehicle.position;
        const snap = timelineActor.getSnapshot().context;
        timelineActor.send({
          type: 'ADD_EYE_WP',
          waypoint: {
            frame: Math.round(snap.currentFrame),
            target: {
              x: Math.round(pos.x * 100) / 100,
              y: Math.round(pos.y * 100) / 100,
              z: Math.round(pos.z * 100) / 100,
            },
            easing: 'smoothstep' as const,
          },
        });
      }
    }
    // T = Frame Selected — recentrer sur l'objet sélectionné
    if ((e.key === 't' || e.key === 'T') && state.freeCameraActive) {
      const obj = selection.getSelectedObject();
      if (obj) {
        e.preventDefault();
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        if (size.length() < 0.01) {
          box.expandByScalar(0.5);
        }
        cameraControls.fitToBox(box, true);
      }
    }
    // H = Home — revenir à la vue initiale
    if ((e.key === 'h' || e.key === 'H') && state.freeCameraActive) {
      e.preventDefault();
      cameraControls.setLookAt(0, 1.5, 12, 0, 1, 0, true);
    }
    // Shift+D = Duplicate selected object
    if (e.key === 'D' && e.shiftKey) {
      e.preventDefault();
      undoManager?.recordAction(); broadcastUndoState();
      const selectedId = selection.getSelectedId();
      if (!selectedId) return;
      if (selectedId === 'model') return;

      let newId: string | null = null;
      const srcObj = selection.getSelectedObject();
      const srcInst = componentRegistry.get(selectedId);

      // Instance already in registry → generic duplicate
      if (srcInst) {
        const inst = componentRegistry.duplicate(srcInst, componentCtx);
        newId = inst.id;
        // Card portal side-effect (DOM only — lifecycle handled generically below)
        if (inst.type === 'card') {
          const extra = inst.extra as CardExtra;
          setCardPortals(prev => new Map(prev).set(inst.id, extra.portalTarget));
        }
      }

      // --- Original neon ---
      else if (selectedId === 'neon' && neonBandsActor) {
        const ctx = neonBandsActor.getSnapshot().context;
        const config: NeonInstanceConfig = { ...ctx, bands: ctx.bands.map(b => ({ ...b })) };
        const inst = componentRegistry.create('neon', 'neon', config, componentCtx);
        if (srcObj) {
          inst.object3D.position.copy(srcObj.position);
          inst.object3D.position.x += 2;
        }
        newId = inst.id;
      }

      // --- Original text (title/subtitle) ---
      else if (selectedId === 'title' || selectedId === 'subtitle') {
        if (!srcObj) return;
        const ctx = timelineActor?.getSnapshot().context;
        if (!ctx) return;
        const isTitle = selectedId === 'title';
        const textConfig = {
          text: isTitle ? ctx.titleText : ctx.subtitleText,
          font: isTitle ? getFontPath(basePath, 'Cynatar.otf') : getFontPath(basePath, 'SF-TransRobotics.ttf'),
          fontSize: isTitle ? ctx.titleFontSize : ctx.subtitleFontSize,
          color: isTitle ? ctx.titleColor : ctx.subtitleColor,
          emissiveIntensity: isTitle ? ctx.titleEmissiveIntensity : ctx.subtitleEmissiveIntensity,
          anchorX: isTitle ? 'center' : 'left',
          anchorY: isTitle ? 'middle' : 'top',
          textAlign: isTitle ? 'center' : 'left',
          maxWidth: isTitle ? undefined : 8,
        };
        const inst = componentRegistry.create('text', selectedId, textConfig, componentCtx);
        inst.object3D.position.copy(srcObj.position);
        inst.object3D.position.x += 2;
        newId = inst.id;
      }

      // --- Original light (dirLight/pointLight) ---
      else if (selectedId === 'dirLight' || selectedId === 'pointLight') {
        if (!srcObj || !(srcObj instanceof THREE.Light)) return;
        const lightConfig = {
          lightType: (srcObj instanceof THREE.PointLight ? 'point' : 'directional') as 'directional' | 'point',
          color: '#' + srcObj.color.getHexString(),
          intensity: srcObj.intensity,
          positionX: srcObj.position.x,
          positionY: srcObj.position.y,
          positionZ: srcObj.position.z,
          distance: srcObj instanceof THREE.PointLight ? srcObj.distance : undefined,
        };
        const inst = componentRegistry.create('light', selectedId, lightConfig, componentCtx);
        inst.object3D.position.copy(srcObj.position);
        inst.object3D.position.x += 2;
        newId = inst.id;
      }

      // --- Original card ---
      else if (selectedId === 'card') {
        const cardConfig = {
          positionX: cardSystem.getProxyMesh().position.x,
          positionY: cardSystem.getProxyMesh().position.y,
          positionZ: cardSystem.getProxyMesh().position.z,
          scale: cardSystem.getProxyMesh().scale.x,
        };
        const inst = componentRegistry.create('card', 'card', cardConfig, componentCtx);
        inst.object3D.position.x += 2;
        newId = inst.id;
        const extra = inst.extra as CardExtra;
        setCardPortals(prev => new Map(prev).set(inst.id, extra.portalTarget));
      }

      // Select the duplicate and attach gizmo in translate mode
      if (newId) {
        selectionActor?.send({ type: 'REGISTER_ID', id: newId });
        selection.select(newId);
        selection.setMode('translate');
        selection.attachGizmo();
        selectionActor?.send({ type: 'SELECT', id: newId });
        selectionActor?.send({ type: 'SET_MODE', mode: 'translate' });

        // Auto-lifecycle for ALL duplicated instances
        if (timelineActor) {
          const snap = timelineActor.getSnapshot().context;
          // Try to copy lifecycle from source
          const srcLifecycle = snap.instanceLifecycles[selectedId]
            ?? (selectedId === 'card' ? snap.cardLayout : null)
            ?? (['title', 'subtitle'].includes(selectedId) ? (() => {
              const layout = selectedId === 'title' ? snap.titleLayout : snap.subtitleLayout;
              return {
                scrollStart: layout.scrollStart, scrollEnd: layout.scrollEnd, easing: layout.easing,
                exitStart: layout.exitStart, exitEnd: layout.exitEnd, exitEasing: layout.exitEasing,
              };
            })() : null);

          if (srcLifecycle) {
            timelineActor.send({ type: 'ADD_INSTANCE_LIFECYCLE', id: newId, lifecycle: { ...srcLifecycle } });
          } else {
            // Default lifecycle: fade-in around current frame, fade-out near end
            const currentFrame = snap.currentFrame;
            const totalFrames = snap.totalFrames;
            timelineActor.send({
              type: 'ADD_INSTANCE_LIFECYCLE', id: newId,
              lifecycle: {
                scrollStart: Math.max(0, currentFrame - 10),
                scrollEnd: currentFrame,
                easing: 'smoothstep' as const,
                exitStart: Math.round(totalFrames * 0.9),
                exitEnd: totalFrames,
                exitEasing: 'smoothstep' as const,
              },
            });
          }
        }

        // Create initial element track keyframe
        if (timelineActor) {
          const obj = selection.getSelectedObject();
          if (obj) {
            const frame = timelineActor.getSnapshot().context.currentFrame;
            timelineActor.send({
              type: 'ADD_ELEMENT_KF',
              elementId: newId,
              keyframe: {
                frame: Math.round(frame),
                position: {
                  x: Math.round(obj.position.x * 100) / 100,
                  y: Math.round(obj.position.y * 100) / 100,
                  z: Math.round(obj.position.z * 100) / 100,
                },
                rotation: {
                  x: Math.round(obj.rotation.x * 1000) / 1000,
                  y: Math.round(obj.rotation.y * 1000) / 1000,
                  z: Math.round(obj.rotation.z * 1000) / 1000,
                },
                scale: Math.round(obj.scale.x * 100) / 100,
                easing: 'smoothstep' as const,
              },
            });
          }
        }
      }
    }

    // Delete / Backspace = Delete selected instance
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selectedId = selection.getSelectedId();
      if (!selectedId || !componentRegistry.has(selectedId)) return;
      e.preventDefault();
      undoManager?.recordAction(); broadcastUndoState();

      const instance = componentRegistry.get(selectedId);
      if (!instance) return;

      // Card portal side-effect before dispose
      if (instance.type === 'card') {
        setCardPortals(prev => { const m = new Map(prev); m.delete(selectedId); return m; });
      }

      componentRegistry.disposeOne(selectedId, componentCtx);

      selection.unregister(selectedId);
      selectionActor?.send({ type: 'UNREGISTER_ID', id: selectedId });
      timelineActor?.send({ type: 'DELETE_ELEMENT_TRACK', elementId: selectedId });
      timelineActor?.send({ type: 'DELETE_INSTANCE_LIFECYCLE', id: selectedId });
      window.dispatchEvent(new CustomEvent('overmind:instance-deleted', { detail: { id: selectedId } }));
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Control' || e.key === 'Shift') {
      selection.setRotationSnap(null);
    }
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
