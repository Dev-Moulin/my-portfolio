import * as THREE from 'three';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry, ComponentSnapshot } from './componentRegistry.ts';
import type { ComponentContext } from './componentDescriptor.ts';
import type { CardSystem } from './cardSystem.ts';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { SceneActors, Disposable } from './sceneContext.ts';
import type { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import type { BandConfig } from '../machines/neonBandsMachine.ts';
import type { NeonInstanceConfig } from './instanceRegistry.ts';
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
}

export function setupConfigBridge(deps: ConfigBridgeDeps): Disposable {
  const {
    actors, selection, componentRegistry, componentCtx, setCardPortals,
    undoManager, camera, basePath, broadcastUndoState,
  } = deps;
  const { selectionActor, timelineActor } = actors;

  // DevPanel → SceneRenderer: apply instance config edits
  function onInstanceConfigUpdate(e: Event) {
    const { id, patch } = (e as CustomEvent<{ id: string; patch: Record<string, unknown> }>).detail;
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
  }
  window.addEventListener('overmind:scene-load-request', onSceneLoadRequest);

  return {
    dispose() {
      window.removeEventListener('overmind:instance-config-update', onInstanceConfigUpdate);
      window.removeEventListener('overmind:create-instance', onCreateInstance);
      window.removeEventListener('overmind:scene-save-request', onSceneSaveRequest);
      window.removeEventListener('overmind:scene-load-request', onSceneLoadRequest);
    },
  };
}
