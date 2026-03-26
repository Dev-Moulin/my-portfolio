import * as THREE from 'three';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry, ComponentSnapshot } from './componentRegistry.ts';
import type { ComponentContext } from './componentDescriptor.ts';
import type { CardSystem } from './cardSystem.ts';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { SceneActors, SceneMutableState, Disposable } from './sceneContext.ts';
import type { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import type { BandConfig } from '../machines/neonBandsMachine.ts';
import type { NeonInstanceConfig, LightInstanceConfig } from './instanceRegistry.ts';
import { DEFAULT_CONFIGS } from './descriptors/index.ts';

export interface ConfigBridgeDeps {
  actors: SceneActors;
  selection: SelectionSystem;
  componentRegistry: ComponentRegistry;
  componentCtx: ComponentContext;
  cardSystem: CardSystem;
  scene: THREE.Scene;
  setCardPortals: React.Dispatch<React.SetStateAction<Map<string, HTMLDivElement>>>;
  undoManager: UndoRedoManager | null;
  camera: THREE.PerspectiveCamera;
  basePath: string;
  broadcastUndoState: () => void;
  state: SceneMutableState;
}

export function setupConfigBridge(deps: ConfigBridgeDeps): Disposable {
  const {
    actors, selection, componentRegistry, componentCtx, setCardPortals,
    undoManager, camera, basePath, broadcastUndoState, state,
  } = deps;
  const { selectionActor, timelineActor } = actors;

  // DevPanel → SceneRenderer: apply instance config edits
  function onInstanceConfigUpdate(e: Event) {
    const { id, patch } = (e as CustomEvent<{ id: string; patch: Record<string, unknown> }>).detail;

    // Light type change → dispose + recreate with same ID
    if ('lightType' in patch) {
      const instance = componentRegistry.get(id);
      if (instance && instance.type === 'light') {
        const oldConfig = instance.config as LightInstanceConfig;
        if (patch.lightType !== oldConfig.lightType) {
          const pos = instance.object3D.position.clone();
          const newConfig: LightInstanceConfig = {
            ...oldConfig,
            ...patch as Partial<LightInstanceConfig>,
          };
          applyLightTypeDefaults(newConfig);

          // Dispose old (dispatches light-helper-detach, removes target, etc.)
          componentRegistry.disposeOne(id, componentCtx);
          selection.unregister(id);
          selectionActor?.send({ type: 'UNREGISTER_ID', id });

          // Recreate with same ID
          const inst = componentRegistry.create('light', 'light', newConfig, componentCtx, id);
          inst.object3D.position.copy(pos);
          componentRegistry.syncFromTransform(id, {
            position: inst.object3D.position.clone(),
            rotation: inst.object3D.rotation.clone(),
            scale: inst.object3D.scale.clone(),
          });

          // Re-select
          selectionActor?.send({ type: 'REGISTER_ID', id });
          selection.select(id);
          selection.attachGizmo();
          selectionActor?.send({ type: 'SELECT', id });
          return;
        }
      }
    }

    // Sync Track To options when changed via updateField
    if ('trackToMaintainDistance' in patch || 'trackToFollowPosition' in patch) {
      const assignment = state.trackToAssignments[id];
      if (assignment) {
        if ('trackToMaintainDistance' in patch) assignment.maintainDistance = patch.trackToMaintainDistance as boolean;
        if ('trackToFollowPosition' in patch) assignment.followPosition = patch.trackToFollowPosition as boolean;
      }
    }

    componentRegistry.applyConfig(id, patch);
  }
  window.addEventListener('overmind:instance-config-update', onInstanceConfigUpdate);

  // Library panel → create new instance
  function onCreateInstance(e: Event) {
    const { type, bands } = (e as CustomEvent<{ type: string; bands?: BandConfig[] }>).detail;
    if (!(type in DEFAULT_CONFIGS)) return;

    undoManager?.recordAction();
    broadcastUndoState();

    // Resolve default config
    const config = type === 'text'
      ? DEFAULT_CONFIGS.text(basePath)
      : DEFAULT_CONFIGS[type as 'neon' | 'light' | 'card']();

    // Override neon bands if provided by the configurator
    if (type === 'neon' && bands && bands.length > 0) {
      (config as NeonInstanceConfig).bands = bands;
    }

    // Determine sourceId for ID generation
    const sourceId = type === 'light' ? 'pointLight' : type;

    const instance = componentRegistry.create(type, sourceId, config, componentCtx);

    // Position in front of camera
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().add(dir.multiplyScalar(5));
    instance.object3D.position.copy(pos);

    // Sync config from the new 3D position
    componentRegistry.syncFromTransform(instance.id, {
      position: instance.object3D.position.clone(),
      rotation: instance.object3D.rotation.clone(),
      scale: instance.object3D.scale.clone(),
    });

    // Card portal side-effect
    if (type === 'card') {
      const extra = instance.extra as CardExtra;
      setCardPortals(prev => new Map(prev).set(instance.id, extra.portalTarget));
    }

    // Register + select + gizmo
    selectionActor?.send({ type: 'REGISTER_ID', id: instance.id });
    selection.select(instance.id);
    selection.setMode('translate');
    selection.attachGizmo();
    selectionActor?.send({ type: 'SELECT', id: instance.id });
    selectionActor?.send({ type: 'SET_MODE', mode: 'translate' });

    // Auto-lifecycle
    if (timelineActor) {
      const snap = timelineActor.getSnapshot().context;
      const currentFrame = snap.currentFrame;
      const totalFrames = snap.totalFrames;
      timelineActor.send({
        type: 'ADD_INSTANCE_LIFECYCLE', id: instance.id,
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

    // Initial element keyframe
    if (timelineActor) {
      const frame = timelineActor.getSnapshot().context.currentFrame;
      const obj = instance.object3D;
      timelineActor.send({
        type: 'ADD_ELEMENT_KF',
        elementId: instance.id,
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

    broadcastUndoState();
  }
  window.addEventListener('overmind:create-instance', onCreateInstance);

  // Scene save bridge: capture instances on request
  function onSceneSaveRequest() {
    const instances = componentRegistry.captureAllSnapshots();
    window.dispatchEvent(new CustomEvent('overmind:scene-save-response', { detail: instances }));
  }
  window.addEventListener('overmind:scene-save-request', onSceneSaveRequest);

  // Scene load bridge: restore instances from save file
  function onSceneLoadRequest(e: Event) {
    const snapInstances = (e as CustomEvent<ComponentSnapshot[]>).detail;
    selection.deselect();
    selectionActor?.send({ type: 'DESELECT' });

    componentRegistry.reconcile(snapInstances, componentCtx, {
      onCreated(instance) {
        selectionActor?.send({ type: 'REGISTER_ID', id: instance.id });
        if (instance.type === 'card') {
          const extra = instance.extra as CardExtra;
          setCardPortals(prev => new Map(prev).set(instance.id, extra.portalTarget));
        }
      },
      onRemoved(id, instance) {
        selection.unregister(id);
        selectionActor?.send({ type: 'UNREGISTER_ID', id });
        if (instance.type === 'card') {
          setCardPortals(prev => { const m = new Map(prev); m.delete(id); return m; });
        }
      },
    });

    // Restore Track To assignments from loaded configs
    state.trackToAssignments = {};
    for (const inst of componentRegistry.getByType('light')) {
      const config = inst.config as LightInstanceConfig;
      if (config.trackToTargetId) {
        const targetObj = selection.getObjectById(config.trackToTargetId);
        if (targetObj) {
          const dist = inst.object3D.position.distanceTo(targetObj.position);
          state.trackToAssignments[inst.id] = {
            targetId: config.trackToTargetId,
            maintainDistance: config.trackToMaintainDistance ?? true,
            followPosition: config.trackToFollowPosition ?? false,
            initialDistance: dist,
          };
        }
      }
    }
  }
  window.addEventListener('overmind:scene-load-request', onSceneLoadRequest);

  // ── Track To constraint ──────────────────────────────────────────────────

  function onTrackToPickStart(e: Event) {
    const { lightId } = (e as CustomEvent<{ lightId: string }>).detail;
    selection.setTargetPickMode(true);
    selection.onTargetPick((targetId) => {
      if (targetId && targetId !== lightId) {
        window.dispatchEvent(new CustomEvent('overmind:track-to-set', {
          detail: { lightId, targetId, maintainDistance: true, followPosition: false },
        }));
      }
    });
  }
  window.addEventListener('overmind:track-to-pick-start', onTrackToPickStart);

  function onTrackToSet(e: Event) {
    const { lightId, targetId, maintainDistance, followPosition } =
      (e as CustomEvent<{ lightId: string; targetId: string; maintainDistance?: boolean; followPosition?: boolean }>).detail;

    const lightObj = selection.getObjectById(lightId);
    const targetObj = selection.getObjectById(targetId);
    if (!lightObj || !targetObj) return;

    const dist = lightObj.position.distanceTo(targetObj.position);

    state.trackToAssignments[lightId] = {
      targetId,
      maintainDistance: maintainDistance ?? true,
      followPosition: followPosition ?? false,
      initialDistance: dist,
    };

    componentRegistry.applyConfig(lightId, {
      trackToTargetId: targetId,
      trackToMaintainDistance: maintainDistance ?? true,
      trackToFollowPosition: followPosition ?? false,
    });
  }
  window.addEventListener('overmind:track-to-set', onTrackToSet);

  function onTrackToClear(e: Event) {
    const { lightId } = (e as CustomEvent<{ lightId: string }>).detail;
    delete state.trackToAssignments[lightId];
    componentRegistry.applyConfig(lightId, {
      trackToTargetId: '',
      trackToMaintainDistance: undefined,
      trackToFollowPosition: undefined,
    });
  }
  window.addEventListener('overmind:track-to-clear', onTrackToClear);

  // Update Track To options without re-picking
  function onTrackToUpdate(e: Event) {
    const { lightId, maintainDistance, followPosition } =
      (e as CustomEvent<{ lightId: string; maintainDistance?: boolean; followPosition?: boolean }>).detail;

    const assignment = state.trackToAssignments[lightId];
    if (!assignment) return;

    if (maintainDistance !== undefined) assignment.maintainDistance = maintainDistance;
    if (followPosition !== undefined) assignment.followPosition = followPosition;

    componentRegistry.applyConfig(lightId, {
      trackToMaintainDistance: assignment.maintainDistance,
      trackToFollowPosition: assignment.followPosition,
    });
  }
  window.addEventListener('overmind:track-to-update', onTrackToUpdate);

  // Cleanup Track To when instances are deleted
  function onDeleteInstance(e: Event) {
    const { id: deletedId } = (e as CustomEvent<{ id: string }>).detail;
    // If the deleted instance was a target for any light, clear those Track To
    for (const [lightId, assignment] of Object.entries(state.trackToAssignments)) {
      if (assignment.targetId === deletedId) {
        delete state.trackToAssignments[lightId];
        componentRegistry.applyConfig(lightId, { trackToTargetId: '' });
      }
    }
    // If the deleted instance itself had a Track To
    delete state.trackToAssignments[deletedId];
  }
  window.addEventListener('overmind:delete-instance', onDeleteInstance);

  return {
    dispose() {
      window.removeEventListener('overmind:instance-config-update', onInstanceConfigUpdate);
      window.removeEventListener('overmind:create-instance', onCreateInstance);
      window.removeEventListener('overmind:scene-save-request', onSceneSaveRequest);
      window.removeEventListener('overmind:scene-load-request', onSceneLoadRequest);
      window.removeEventListener('overmind:track-to-pick-start', onTrackToPickStart);
      window.removeEventListener('overmind:track-to-set', onTrackToSet);
      window.removeEventListener('overmind:track-to-clear', onTrackToClear);
      window.removeEventListener('overmind:track-to-update', onTrackToUpdate);
      window.removeEventListener('overmind:delete-instance', onDeleteInstance);
    },
  };
}

/** Fill in sensible defaults for type-specific light properties. */
function applyLightTypeDefaults(config: LightInstanceConfig): void {
  switch (config.lightType) {
    case 'spot':
      config.distance ??= 10;
      config.angle ??= Math.PI / 6;
      config.penumbra ??= 0.3;
      config.decay ??= 2;
      config.targetX ??= 0;
      config.targetY ??= 0;
      config.targetZ ??= 0;
      break;
    case 'directional':
      config.targetX ??= 0;
      config.targetY ??= 0;
      config.targetZ ??= 0;
      break;
    case 'area':
      config.areaWidth ??= 2;
      config.areaHeight ??= 2;
      break;
    case 'point':
      config.distance ??= 20;
      break;
  }
}
