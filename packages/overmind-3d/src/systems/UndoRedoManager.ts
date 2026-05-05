import type { ActorRefFrom } from 'xstate';
import type * as THREE from 'three';

import type { bloomMachine } from '../machines/bloomMachine.ts';
import type { lightsMachine } from '../machines/lightsMachine.ts';
import { powerToIntensity, intensityToPower } from '../machines/lightsMachine.ts';
import type { materialMachine } from '../machines/materialMachine.ts';
import type { modelMachine } from '../machines/modelMachine.ts';
import type { sceneMachine } from '../machines/sceneMachine.ts';
import type { steeringMachine, SteeringContext } from '../machines/steeringMachine.ts';
import type { timelineMachine, TimelineContext } from '../machines/timelineMachine.ts';
import type { selectionMachine } from '../machines/selectionMachine.ts';
import type { ModelSettings } from '../scene/types.ts';
import type { ComponentRegistry, ComponentSnapshot } from '../scene/componentRegistry.ts';
import type { ComponentContext } from '../scene/componentDescriptor.ts';
import type { CardExtra } from '../scene/descriptors/cardDescriptor.ts';
import type { SelectionSystem } from '../scene/selectionSystem.ts';

// ── Serializable snapshot types ──────────────────────────────────────────────

export interface BloomSnapshot {
  threshold: number;
  strength: number;
  radius: number;
  enabled: boolean;
  bloomColor: string;
}

export interface LightingSnapshot {
  ambientIntensity: number;
  directionalIntensity: number;
  pointIntensity: number;
  exposure: number;
  hdrBoostEnabled: boolean;
  hdrBoostMultiplier: number;
  directionalPosition: { x: number; y: number; z: number };
  pointPosition: { x: number; y: number; z: number };
  currentPreset: string;
}

export interface MaterialGroupSnapshot {
  emissiveColor: string;
  emissiveIntensity: number;
  visible: boolean;
}

export interface MaterialSnapshot {
  iris: MaterialGroupSnapshot;
  eyeRings: MaterialGroupSnapshot;
  revealRings: MaterialGroupSnapshot;
}

export interface SceneSnapshot {
  backgroundColor: string;
  cameraX: number; cameraY: number; cameraZ: number;
  lookAtX: number; lookAtY: number; lookAtZ: number;
  fov: number;
  near: number;
  far: number;
  gridVisible: boolean;
  gridSize: number;
  gridDivisions: number;
  gridColor1: string;
  gridColor2: string;
  axesVisible: boolean;
  axesSize: number;
  viewMode: 'camera' | 'free';
  pipVisible: boolean;
  pipSize: 'S' | 'L';
  lightHelpersVisible: boolean;
}

export interface SelectionSnapshot {
  selectedId: string | null;
  selectedIds: string[];
  mode: 'translate' | 'rotate' | 'scale';
}

export interface InstanceSnapshot {
  id: string;
  type: string;
  sourceId: string;
  config: unknown;
  position: { x: number; y: number; z: number };
}

export interface UndoSnapshot {
  bloom: BloomSnapshot;
  lighting: LightingSnapshot;
  material: MaterialSnapshot;
  model: ModelSettings;
  scene: SceneSnapshot;
  steering: SteeringContext;
  selection: SelectionSnapshot;
  timeline: Omit<TimelineContext, 'computed'>;
  instances: ComponentSnapshot[];
}

// ── Actors map ───────────────────────────────────────────────────────────────

interface Actors {
  bloom: ActorRefFrom<typeof bloomMachine>;
  lights: ActorRefFrom<typeof lightsMachine>;
  material: ActorRefFrom<typeof materialMachine>;
  model: ActorRefFrom<typeof modelMachine>;
  scene: ActorRefFrom<typeof sceneMachine>;
  steering: ActorRefFrom<typeof steeringMachine>;
  timeline: ActorRefFrom<typeof timelineMachine>;
  selection: ActorRefFrom<typeof selectionMachine>;
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class UndoRedoManager {
  undoStack: UndoSnapshot[] = [];
  redoStack: UndoSnapshot[] = [];
  maxHistory = 50;
  actors: Actors;
  componentRegistry: ComponentRegistry;
  componentCtx: ComponentContext;
  selectionSystem: SelectionSystem;
  threeScene: THREE.Scene;

  constructor(
    actors: Actors,
    componentRegistry: ComponentRegistry,
    componentCtx: ComponentContext,
    selectionSystem: SelectionSystem,
    threeScene: THREE.Scene,
  ) {
    this.actors = actors;
    this.componentRegistry = componentRegistry;
    this.componentCtx = componentCtx;
    this.selectionSystem = selectionSystem;
    this.threeScene = threeScene;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  recordAction(): void {
    const snap = this.captureSnapshot();
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    const current = this.captureSnapshot();
    this.redoStack.push(current);
    const snap = this.undoStack.pop()!;
    this.restoreSnapshot(snap);
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    const current = this.captureSnapshot();
    this.undoStack.push(current);
    const snap = this.redoStack.pop()!;
    this.restoreSnapshot(snap);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  captureSnapshot(): UndoSnapshot {
    const bloomCtx = this.actors.bloom.getSnapshot().context;
    const lightsCtx = this.actors.lights.getSnapshot().context;
    const matCtx = this.actors.material.getSnapshot().context;
    const modelCtx = this.actors.model.getSnapshot().context;
    const sceneCtx = this.actors.scene.getSnapshot().context;
    const steerCtx = this.actors.steering.getSnapshot().context;
    const selCtx = this.actors.selection.getSnapshot().context;
    const tlCtx = this.actors.timeline.getSnapshot().context;

    // Deep-clone serializable fields
    const bloom: BloomSnapshot = {
      threshold: bloomCtx.threshold,
      strength: bloomCtx.strength,
      radius: bloomCtx.radius,
      enabled: bloomCtx.enabled,
      bloomColor: bloomCtx.bloomColor,
    };

    const dirEntry = lightsCtx.lights.get('dirLight');
    const pointEntry = lightsCtx.lights.get('pointLight');
    const lighting: LightingSnapshot = {
      ambientIntensity: lightsCtx.environment.ambientIntensity,
      directionalIntensity: dirEntry ? powerToIntensity(dirEntry.lightType, dirEntry.power, dirEntry) : 2.0,
      pointIntensity: pointEntry ? powerToIntensity(pointEntry.lightType, pointEntry.power, pointEntry) : 2.0,
      exposure: lightsCtx.environment.exposure,
      hdrBoostEnabled: lightsCtx.environment.hdrBoostEnabled,
      hdrBoostMultiplier: lightsCtx.environment.hdrBoostMultiplier,
      directionalPosition: dirEntry ? { ...dirEntry.position } : { x: 1, y: 2, z: 3 },
      pointPosition: pointEntry ? { ...pointEntry.position } : { x: 0, y: 2, z: 0 },
      currentPreset: lightsCtx.environment.currentPreset,
    };

    const cloneGroup = (g: { emissiveColor: string; emissiveIntensity: number; visible: boolean }): MaterialGroupSnapshot => ({
      emissiveColor: g.emissiveColor,
      emissiveIntensity: g.emissiveIntensity,
      visible: g.visible,
    });
    const material: MaterialSnapshot = {
      iris: cloneGroup(matCtx.groups.iris),
      eyeRings: cloneGroup(matCtx.groups.eyeRings),
      revealRings: cloneGroup(matCtx.groups.revealRings),
    };

    const model: ModelSettings = { ...modelCtx };

    const scene: SceneSnapshot = {
      backgroundColor: sceneCtx.backgroundColor,
      cameraX: sceneCtx.cameraX, cameraY: sceneCtx.cameraY, cameraZ: sceneCtx.cameraZ,
      lookAtX: sceneCtx.lookAtX, lookAtY: sceneCtx.lookAtY, lookAtZ: sceneCtx.lookAtZ,
      fov: sceneCtx.fov,
      near: sceneCtx.near,
      far: sceneCtx.far,
      gridVisible: sceneCtx.gridVisible,
      gridSize: sceneCtx.gridSize,
      gridDivisions: sceneCtx.gridDivisions,
      gridColor1: sceneCtx.gridColor1,
      gridColor2: sceneCtx.gridColor2,
      axesVisible: sceneCtx.axesVisible,
      axesSize: sceneCtx.axesSize,
      viewMode: sceneCtx.viewMode,
      pipVisible: sceneCtx.pipVisible,
      pipSize: sceneCtx.pipSize,
      lightHelpersVisible: sceneCtx.lightHelpersVisible,
    };

    const steering: SteeringContext = { ...steerCtx };

    const selection: SelectionSnapshot = {
      selectedId: selCtx.selectedId,
      selectedIds: [...selCtx.selectedIds],
      mode: selCtx.mode,
    };

    // Timeline: everything except `computed`
    const { computed: _computed, ...timelineData } = tlCtx;
    const timeline = {
      ...timelineData,
      dwells: tlCtx.dwells.map(d => ({ ...d })),
      cameraKeyframes: tlCtx.cameraKeyframes.map(kf => ({ ...kf })),
      titleLayout: { ...tlCtx.titleLayout },
      subtitleLayout: { ...tlCtx.subtitleLayout },
      visualKeyframes: tlCtx.visualKeyframes.map(vk => ({
        ...vk,
        bloom: { ...vk.bloom },
        lighting: { ...vk.lighting },
        material: {
          iris: { ...vk.material.iris },
          eyeRings: { ...vk.material.eyeRings },
          revealRings: { ...vk.material.revealRings },
        },
        scene: { ...vk.scene },
      })),
      elementTracks: Object.fromEntries(
        Object.entries(tlCtx.elementTracks).map(([id, kfs]) => [
          id, kfs.map(kf => ({
            ...kf,
            position: { ...kf.position },
            rotation: { ...kf.rotation },
          })),
        ])
      ),
    };

    // Instances — delegate to ComponentRegistry
    const instances = this.componentRegistry.captureAllSnapshots();

    return { bloom, lighting, material, model, scene, steering, selection, timeline, instances };
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  restoreSnapshot(snap: UndoSnapshot): void {
    // 1. Deselect first (detach gizmo)
    this.selectionSystem.deselect();

    // 2. Restore machine contexts
    this.actors.bloom.send({ type: 'RESTORE_CONTEXT', context: snap.bloom });
    // Convert LightingSnapshot back to LightsSnapshot for the new machine
    const dirLightEntry = {
      id: 'dirLight', lightType: 'directional' as const, isDefault: true,
      power: intensityToPower('directional', snap.lighting.directionalIntensity),
      color: '#ffffff', position: { ...snap.lighting.directionalPosition },
      rotation: { x: 0, y: 0, z: 0 }, distance: 0, decay: 2,
    };
    const pointLightEntry = {
      id: 'pointLight', lightType: 'point' as const, isDefault: true,
      power: intensityToPower('point', snap.lighting.pointIntensity),
      color: '#00ffff', position: { ...snap.lighting.pointPosition },
      rotation: { x: 0, y: 0, z: 0 }, distance: 100, decay: 2,
    };
    // Include any non-default lights from the current state
    const currentLights = this.actors.lights.getSnapshot().context.lights;
    const extraLights = Array.from(currentLights.values()).filter(l => !l.isDefault);
    this.actors.lights.send({
      type: 'RESTORE',
      snapshot: {
        environment: {
          ambientIntensity: snap.lighting.ambientIntensity,
          ambientColor: '#ffffff',
          exposure: snap.lighting.exposure,
          hdrBoostEnabled: snap.lighting.hdrBoostEnabled,
          hdrBoostMultiplier: snap.lighting.hdrBoostMultiplier,
          currentPreset: snap.lighting.currentPreset,
          sun: { colorCore: '#fff8e0', colorMid: '#ffaa22', colorEdge: '#ff4400', emissiveStrength: 3.0, displaceStrength: 0.15, pulseSpeed: 1.5 },
        },
        lights: [dirLightEntry, pointLightEntry, ...extraLights],
      },
    });
    this.actors.material.send({ type: 'RESTORE_CONTEXT', context: snap.material });
    this.actors.model.send({ type: 'RESTORE_CONTEXT', context: snap.model });
    this.actors.scene.send({ type: 'RESTORE_CONTEXT', context: snap.scene });
    this.actors.steering.send({ type: 'RESTORE_CONTEXT', context: snap.steering });
    this.actors.timeline.send({ type: 'RESTORE_CONTEXT', context: snap.timeline as Omit<TimelineContext, 'computed'> });

    // 3. Diff instances via ComponentRegistry
    this.componentRegistry.reconcile(snap.instances, this.componentCtx, {
      onRemoved: (id, instance) => {
        this.selectionSystem.unregister(id);
        if (instance.type === 'card') {
          window.dispatchEvent(new CustomEvent('overmind:card-portal-remove', { detail: { id } }));
        }
      },
      onCreated: (instance) => {
        if (instance.type === 'card') {
          const extra = instance.extra as CardExtra;
          window.dispatchEvent(new CustomEvent('overmind:card-portal-add', {
            detail: { id: instance.id, portalTarget: extra.portalTarget },
          }));
        }
      },
    });

    // 4. Re-select if needed (supports multi-selection)
    if (snap.selection.selectedIds.length > 0) {
      this.selectionSystem.restoreSelection(snap.selection.selectedIds);
      this.actors.selection.send({ type: 'SET_SELECTED_IDS', ids: snap.selection.selectedIds });
    }
    this.actors.selection.send({ type: 'SET_MODE', mode: snap.selection.mode });
  }
}
