import * as THREE from 'three';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { KeyboardDeps } from './keyboardHandler.ts';
import { getFontPath } from '../utils/dracoPath.ts';

/**
 * Object Mode keyboard shortcuts.
 * Returns true if the event was handled.
 */
export function handleObjectModeKeyDown(e: KeyboardEvent, deps: KeyboardDeps): boolean {
  const {
    actors, selection, componentRegistry, componentCtx, undoManager, cardSystem,
    cameraControls, camera, state, basePath,
    setCardPortals,
    captureKeyframe, insertInterpolatedKeyframe,
    captureElementKeyframe, broadcastUndoState,
  } = deps;
  const { timelineActor, selectionActor } = actors;

  // I = Insert keyframe (smart)
  if (e.key === 'i' || e.key === 'I') {
    undoManager?.recordAction(); broadcastUndoState();
    if (selection.getSelectedCount() > 0) {
      captureElementKeyframe();
    } else if (state.freeCameraActive) {
      captureKeyframe();
    } else {
      insertInterpolatedKeyframe();
    }
    return true;
  }

  // G = Grab (translate) — skip when Ctrl/Cmd held
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

  // R = Rotate (skip when Ctrl/Cmd held — let browser handle Ctrl+Shift+R refresh)
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

  // Ctrl+M = Mirror
  if ((e.key === 'm' || e.key === 'M') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (selection.isMirroring()) return true;
    if (selection.getSelectedId()) {
      selection.enterMirror();
    }
    return true;
  }

  // S = Scale — skip when Ctrl/Cmd held (let browser handle Ctrl+S save)
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

  // B = Box Select
  if (e.key === 'b' || e.key === 'B') {
    e.preventDefault();
    if (selection.isBoxSelecting()) return true;
    selection.enterBoxSelect();
    return true;
  }

  // A = Select All, Alt+A = Deselect All
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

  // Alt+H = Toggle visibility of selected object
  if ((e.key === 'h' || e.key === 'H') && e.altKey) {
    e.preventDefault();
    const sel = selection.getSelectedId();
    if (sel) {
      selectionActor?.send({ type: 'TOGGLE_VISIBILITY', id: sel });
    } else {
      selectionActor?.send({ type: 'SHOW_ALL' });
    }
    return true;
  }

  // Alt+L = Toggle lock of selected object
  if ((e.key === 'l' || e.key === 'L') && e.altKey) {
    e.preventDefault();
    const sel = selection.getSelectedId();
    if (sel) {
      selectionActor?.send({ type: 'TOGGLE_LOCKED', id: sel });
    }
    return true;
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
    return true;
  }

  // H = Home — revenir à la vue initiale
  if ((e.key === 'h' || e.key === 'H') && state.freeCameraActive) {
    e.preventDefault();
    cameraControls.setLookAt(0, 1.5, 12, 0, 1, 0, true);
    return true;
  }

  // Shift+D = Duplicate selected object(s) — multi-select aware
  if (e.key === 'D' && e.shiftKey) {
    e.preventDefault();
    undoManager?.recordAction(); broadcastUndoState();

    const sourceIds = selection.getSelectedIds().filter(id => id !== 'model');
    if (sourceIds.length === 0) return true;

    function duplicateOne(sourceId: string): string | null {
      const srcObj = selection.getObjectById(sourceId);
      const srcInst = componentRegistry.get(sourceId);

      if (srcInst) {
        const inst = componentRegistry.duplicate(srcInst, componentCtx, { x: 0, y: 0, z: 0 });
        if (inst.type === 'card') {
          const extra = inst.extra as CardExtra;
          setCardPortals(prev => new Map(prev).set(inst.id, extra.portalTarget));
        }
        return inst.id;
      }

      if (sourceId === 'title' || sourceId === 'subtitle') {
        if (!srcObj) return null;
        const ctx = timelineActor?.getSnapshot().context;
        if (!ctx) return null;
        const isTitle = sourceId === 'title';
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
        const inst = componentRegistry.create('text', sourceId, textConfig, componentCtx);
        inst.object3D.position.copy(srcObj.position);
        return inst.id;
      }

      if (sourceId === 'dirLight' || sourceId === 'pointLight') {
        if (!srcObj || !(srcObj instanceof THREE.Light)) return null;
        const lightConfig = {
          lightType: (srcObj instanceof THREE.PointLight ? 'point' : 'directional') as 'directional' | 'point',
          color: '#' + srcObj.color.getHexString(),
          intensity: srcObj.intensity,
          positionX: srcObj.position.x,
          positionY: srcObj.position.y,
          positionZ: srcObj.position.z,
          distance: srcObj instanceof THREE.PointLight ? srcObj.distance : undefined,
        };
        const inst = componentRegistry.create('light', sourceId, lightConfig, componentCtx);
        inst.object3D.position.copy(srcObj.position);
        return inst.id;
      }

      if (sourceId === 'card') {
        const cardConfig = {
          positionX: cardSystem.getProxyMesh().position.x,
          positionY: cardSystem.getProxyMesh().position.y,
          positionZ: cardSystem.getProxyMesh().position.z,
          scale: cardSystem.getProxyMesh().scale.x,
        };
        const inst = componentRegistry.create('card', 'card', cardConfig, componentCtx);
        const extra = inst.extra as CardExtra;
        setCardPortals(prev => new Map(prev).set(inst.id, extra.portalTarget));
        return inst.id;
      }

      return null;
    }

    const newIds: string[] = [];
    for (const sourceId of sourceIds) {
      const newId = duplicateOne(sourceId);
      if (newId) newIds.push(newId);
    }
    if (newIds.length === 0) return true;

    for (let i = 0; i < newIds.length; i++) {
      const newId = newIds[i];
      const sourceId = sourceIds[i];

      selectionActor?.send({ type: 'REGISTER_ID', id: newId });

      if (timelineActor) {
        const snap = timelineActor.getSnapshot().context;
        const srcLifecycle = snap.instanceLifecycles[sourceId]
          ?? (sourceId === 'card' ? snap.cardLayout : null)
          ?? (['title', 'subtitle'].includes(sourceId) ? (() => {
            const layout = sourceId === 'title' ? snap.titleLayout : snap.subtitleLayout;
            return {
              scrollStart: layout.scrollStart, scrollEnd: layout.scrollEnd, easing: layout.easing,
              exitStart: layout.exitStart, exitEnd: layout.exitEnd, exitEasing: layout.exitEasing,
            };
          })() : null);

        if (srcLifecycle) {
          timelineActor.send({ type: 'ADD_INSTANCE_LIFECYCLE', id: newId, lifecycle: { ...srcLifecycle } });
        } else {
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

      if (timelineActor) {
        const obj = selection.getObjectById(newId);
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

    selection.restoreSelection(newIds);
    selectionActor?.send({ type: 'SET_SELECTED_IDS', ids: newIds });
    selectionActor?.send({ type: 'SET_MODE', mode: 'translate' });
    selection.enterGrab(camera);
    return true;
  }

  // Delete / Backspace = Delete selected instance(s) from component registry
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const selectedId = selection.getSelectedId();
    if (!selectedId || !componentRegistry.has(selectedId)) return false;
    e.preventDefault();
    undoManager?.recordAction(); broadcastUndoState();

    const instance = componentRegistry.get(selectedId);
    if (!instance) return true;

    if (instance.type === 'card') {
      setCardPortals(prev => { const m = new Map(prev); m.delete(selectedId); return m; });
    }

    componentRegistry.disposeOne(selectedId, componentCtx);
    selection.unregister(selectedId);
    selectionActor?.send({ type: 'UNREGISTER_ID', id: selectedId });
    timelineActor?.send({ type: 'DELETE_ELEMENT_TRACK', elementId: selectedId });
    timelineActor?.send({ type: 'DELETE_INSTANCE_LIFECYCLE', id: selectedId });
    window.dispatchEvent(new CustomEvent('overmind:instance-deleted', { detail: { id: selectedId } }));
    return true;
  }

  return false;
}
