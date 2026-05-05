import { useCallback, useEffect, useRef } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { bloomMachine } from '../machines/bloomMachine.ts';
import type { lightsMachine } from '../machines/lightsMachine.ts';
import { powerToIntensity, intensityToPower } from '../machines/lightsMachine.ts';
import type { pbrMachine } from '../machines/pbrMachine.ts';
import type { materialMachine } from '../machines/materialMachine.ts';
import type { sceneMachine } from '../machines/sceneMachine.ts';
import type { modelMachine } from '../machines/modelMachine.ts';
import type { steeringMachine } from '../machines/steeringMachine.ts';
import type { timelineMachine, TimelineContext } from '../machines/timelineMachine.ts';
import type { selectionMachine } from '../machines/selectionMachine.ts';
import type { visualPresetMachine } from '../machines/visualPresetMachine.ts';
import type { PBRGroup } from '../machines/pbrMachine.ts';
import type { Situation, VisualPreset } from '../data/defaultPresets.ts';
import type {
  BloomSnapshot, LightingSnapshot, MaterialSnapshot, SceneSnapshot,
  InstanceSnapshot,
} from '../systems/UndoRedoManager.ts';
import {
  SAVE_FILE_VERSION,
  validateSaveFile,
  type SceneSaveFile,
  type PBRSaveSnapshot,
  type VisualPresetsSaveSnapshot,
} from '../systems/sceneSaveFile.ts';

// ── Actor types ─────────────────────────────────────────────────────────────

interface SceneSaveActors {
  bloom: ActorRefFrom<typeof bloomMachine>;
  lights: ActorRefFrom<typeof lightsMachine>;
  pbr: ActorRefFrom<typeof pbrMachine>;
  material: ActorRefFrom<typeof materialMachine>;
  scene: ActorRefFrom<typeof sceneMachine>;
  model: ActorRefFrom<typeof modelMachine>;
  steering: ActorRefFrom<typeof steeringMachine>;
  timeline: ActorRefFrom<typeof timelineMachine>;
  selection: ActorRefFrom<typeof selectionMachine>;
  visualPreset: ActorRefFrom<typeof visualPresetMachine>;
}

// ── Capture helpers (same logic as UndoRedoManager.captureSnapshot) ─────────

function captureBloom(actor: SceneSaveActors['bloom']): BloomSnapshot {
  const c = actor.getSnapshot().context;
  return { threshold: c.threshold, strength: c.strength, radius: c.radius, enabled: c.enabled, bloomColor: c.bloomColor };
}

function captureLighting(actor: SceneSaveActors['lights']): LightingSnapshot {
  const c = actor.getSnapshot().context;
  const dirEntry = c.lights.get('dirLight');
  const pointEntry = c.lights.get('pointLight');
  return {
    ambientIntensity: c.environment.ambientIntensity,
    directionalIntensity: dirEntry ? powerToIntensity(dirEntry.lightType, dirEntry.power, dirEntry) : 2.0,
    pointIntensity: pointEntry ? powerToIntensity(pointEntry.lightType, pointEntry.power, pointEntry) : 2.0,
    exposure: c.environment.exposure,
    hdrBoostEnabled: c.environment.hdrBoostEnabled,
    hdrBoostMultiplier: c.environment.hdrBoostMultiplier,
    directionalPosition: dirEntry ? { ...dirEntry.position } : { x: 1, y: 2, z: 3 },
    pointPosition: pointEntry ? { ...pointEntry.position } : { x: 0, y: 2, z: 0 },
    currentPreset: c.environment.currentPreset,
  };
}

function captureMaterial(actor: SceneSaveActors['material']): MaterialSnapshot {
  const c = actor.getSnapshot().context;
  const cloneGroup = (g: { emissiveColor: string; emissiveIntensity: number; visible: boolean }) => ({
    emissiveColor: g.emissiveColor,
    emissiveIntensity: g.emissiveIntensity,
    visible: g.visible,
  });
  return {
    iris: cloneGroup(c.groups.iris),
    eyeRings: cloneGroup(c.groups.eyeRings),
    revealRings: cloneGroup(c.groups.revealRings),
  };
}

function captureScene(actor: SceneSaveActors['scene']): SceneSnapshot {
  const c = actor.getSnapshot().context;
  return {
    backgroundColor: c.backgroundColor,
    cameraX: c.cameraX, cameraY: c.cameraY, cameraZ: c.cameraZ,
    lookAtX: c.lookAtX, lookAtY: c.lookAtY, lookAtZ: c.lookAtZ,
    fov: c.fov,
    near: c.near,
    far: c.far,
    gridVisible: c.gridVisible,
    gridSize: c.gridSize,
    gridDivisions: c.gridDivisions,
    gridColor1: c.gridColor1,
    gridColor2: c.gridColor2,
    axesVisible: c.axesVisible,
    axesSize: c.axesSize,
    viewMode: c.viewMode,
    pipVisible: c.pipVisible,
    pipSize: c.pipSize,
    lightHelpersVisible: c.lightHelpersVisible,
  };
}

function captureTimeline(actor: SceneSaveActors['timeline']): Omit<TimelineContext, 'computed'> {
  const c = actor.getSnapshot().context;
  const { computed: _computed, ...data } = c;
  return {
    ...data,
    dwells: c.dwells.map(d => ({ ...d })),
    cameraKeyframes: c.cameraKeyframes.map(kf => ({ ...kf })),
    titleLayout: { ...c.titleLayout },
    subtitleLayout: { ...c.subtitleLayout },
    visualKeyframes: c.visualKeyframes.map(vk => ({
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
      Object.entries(c.elementTracks).map(([id, kfs]) => [
        id, kfs.map(kf => ({
          ...kf,
          position: { ...kf.position },
          rotation: { ...kf.rotation },
        })),
      ])
    ),
  };
}

function capturePBR(actor: SceneSaveActors['pbr']): PBRSaveSnapshot {
  const c = actor.getSnapshot().context;
  const ALL_GROUPS: PBRGroup[] = ['eyeRings', 'iris', 'magicRings', 'arms'];
  const groups: Record<string, { metalness: number; roughness: number }> = {};
  for (const g of ALL_GROUPS) {
    groups[g] = { metalness: c.groups[g].metalness, roughness: c.groups[g].roughness };
  }
  return { toneMapping: c.toneMapping, groups, currentPreset: c.currentPreset };
}

function captureVisualPresets(actor: SceneSaveActors['visualPreset']): VisualPresetsSaveSnapshot {
  const c = actor.getSnapshot().context;
  return {
    situation: c.situation,
    presets: structuredClone(c.presets),
    transitionDurations: { ...c.transitionDurations },
  };
}

// ── Request instances from SceneRenderer via CustomEvent bridge ──────────────

function requestInstances(): Promise<InstanceSnapshot[]> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('overmind:scene-save-response', handler);
      resolve([]);
    }, 2000);

    function handler(e: Event) {
      clearTimeout(timeout);
      window.removeEventListener('overmind:scene-save-response', handler);
      resolve((e as CustomEvent<InstanceSnapshot[]>).detail);
    }

    window.addEventListener('overmind:scene-save-response', handler);
    window.dispatchEvent(new CustomEvent('overmind:scene-save-request'));
  });
}

// ── File Picker API export ──────────────────────────────────────────────────

async function saveToFile(json: string, suggestedName: string): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch {
      return; // user cancelled
    }
  }
  // Fallback: download via anchor
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSceneSave(actors: SceneSaveActors) {
  const actorsRef = useRef(actors);
  actorsRef.current = actors;

  const exportScene = useCallback(async (name?: string) => {
    const a = actorsRef.current;
    const instances = await requestInstances();

    const saveFile: SceneSaveFile = {
      version: SAVE_FILE_VERSION,
      meta: {
        name: name || 'scene',
        createdAt: new Date().toISOString(),
      },
      bloom: captureBloom(a.bloom),
      lighting: captureLighting(a.lights),
      material: captureMaterial(a.material),
      model: { ...a.model.getSnapshot().context },
      scene: captureScene(a.scene),
      steering: { ...a.steering.getSnapshot().context },
      timeline: captureTimeline(a.timeline),
      pbr: capturePBR(a.pbr),
      visualPresets: captureVisualPresets(a.visualPreset),
      instances,
    };

    const json = JSON.stringify(saveFile, null, 2);
    const fileName = `overmind-scene${name ? `-${name}` : ''}.json`;
    await saveToFile(json, fileName);
  }, []);

  const importScene = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const saveFile = validateSaveFile(raw);
        if (!saveFile) {
          console.error('[SceneSave] Invalid save file');
          return;
        }

        const a = actorsRef.current;

        // Restore machine contexts
        a.bloom.send({ type: 'RESTORE_CONTEXT', context: saveFile.bloom });
        // Convert old LightingSnapshot to new RESTORE format
        const sl = saveFile.lighting;
        a.lights.send({
          type: 'RESTORE',
          snapshot: {
            environment: {
              ambientIntensity: sl.ambientIntensity,
              ambientColor: '#ffffff',
              exposure: sl.exposure,
              hdrBoostEnabled: sl.hdrBoostEnabled,
              hdrBoostMultiplier: sl.hdrBoostMultiplier,
              currentPreset: sl.currentPreset,
              sun: { colorCore: '#fff8e0', colorMid: '#ffaa22', colorEdge: '#ff4400', emissiveStrength: 3.0, displaceStrength: 0.15, pulseSpeed: 1.5 },
            },
            lights: [
              {
                id: 'dirLight', lightType: 'directional', isDefault: true,
                power: intensityToPower('directional', sl.directionalIntensity),
                color: '#ffffff', position: { ...sl.directionalPosition },
                rotation: { x: 0, y: 0, z: 0 }, distance: 0, decay: 2,
              },
              {
                id: 'pointLight', lightType: 'point', isDefault: true,
                power: intensityToPower('point', sl.pointIntensity),
                color: '#00ffff', position: { ...sl.pointPosition },
                rotation: { x: 0, y: 0, z: 0 }, distance: 100, decay: 2,
              },
            ],
          },
        });
        a.material.send({ type: 'RESTORE_CONTEXT', context: saveFile.material });
        a.model.send({ type: 'RESTORE_CONTEXT', context: saveFile.model });
        a.scene.send({ type: 'RESTORE_CONTEXT', context: saveFile.scene });
        a.steering.send({ type: 'RESTORE_CONTEXT', context: saveFile.steering });
        a.timeline.send({ type: 'RESTORE_CONTEXT', context: saveFile.timeline as Omit<TimelineContext, 'computed'> });
        a.pbr.send({ type: 'RESTORE_CONTEXT', context: saveFile.pbr });

        // Restore visual presets via existing events
        if (saveFile.visualPresets.presets && Object.keys(saveFile.visualPresets.presets).length > 0) {
          a.visualPreset.send({
            type: 'LOAD_PRESETS',
            presets: saveFile.visualPresets.presets as Record<Situation, VisualPreset>,
            durations: saveFile.visualPresets.transitionDurations,
          });
        }
        if (saveFile.visualPresets.situation) {
          a.visualPreset.send({
            type: 'SET_SITUATION',
            situation: saveFile.visualPresets.situation as Situation,
          });
        }

        // Restore instances via bridge
        window.dispatchEvent(new CustomEvent('overmind:scene-load-request', { detail: saveFile.instances }));

      } catch (err) {
        console.error('[SceneSave] Failed to parse save file:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  // Listen for Ctrl+S trigger from SceneRenderer
  useEffect(() => {
    const handler = () => { exportScene(); };
    window.addEventListener('overmind:scene-save-trigger', handler);
    return () => window.removeEventListener('overmind:scene-save-trigger', handler);
  }, [exportScene]);

  return { exportScene, importScene };
}
