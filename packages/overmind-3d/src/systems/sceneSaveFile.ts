import type {
  BloomSnapshot,
  LightingSnapshot,
  MaterialSnapshot,
  SceneSnapshot,
  InstanceSnapshot,
} from './UndoRedoManager.ts';
import type { ModelSettings } from '../scene/types.ts';
import type { SteeringContext } from '../machines/steeringMachine.ts';
import type { TimelineContext } from '../machines/timelineMachine.ts';
import type { VisualPreset } from '../data/defaultPresets.ts';
import type { ToneMappingType } from '../utils/toneMappingMap.ts';
import type { PBRPresetKey } from '../utils/pbrPresets.ts';

// ── Save file format ────────────────────────────────────────────────────────

export const SAVE_FILE_VERSION = 1;

export interface PBRSaveSnapshot {
  toneMapping: ToneMappingType;
  groups: Record<string, { metalness: number; roughness: number }>;
  currentPreset: PBRPresetKey | null;
}

export interface VisualPresetsSaveSnapshot {
  situation: string;
  presets: Record<string, VisualPreset>;
  transitionDurations: Record<string, number>;
}

export interface SceneSaveFile {
  version: number;
  meta: { name: string; createdAt: string };
  // Machine contexts (same types as UndoSnapshot)
  bloom: BloomSnapshot;
  lighting: LightingSnapshot;
  material: MaterialSnapshot;
  model: ModelSettings;
  scene: SceneSnapshot;
  steering: SteeringContext;
  timeline: Omit<TimelineContext, 'computed'>;
  // Extensions beyond UndoSnapshot
  pbr: PBRSaveSnapshot;
  visualPresets: VisualPresetsSaveSnapshot;
  // Duplicated instances
  instances: InstanceSnapshot[];
}

// ── Validation ──────────────────────────────────────────────────────────────

const REQUIRED_KEYS: (keyof SceneSaveFile)[] = [
  'version', 'bloom', 'lighting', 'material', 'model',
  'scene', 'steering', 'timeline', 'instances',
];

export function validateSaveFile(data: unknown): SceneSaveFile | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'number' || obj.version > SAVE_FILE_VERSION) {
    console.warn('[SceneSave] Unsupported save file version:', obj.version);
    return null;
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      console.warn(`[SceneSave] Missing required key: ${key}`);
      return null;
    }
  }

  // Provide defaults for optional extensions
  if (!obj.pbr) {
    obj.pbr = {
      toneMapping: 'ACESFilmicToneMapping',
      groups: {},
      currentPreset: null,
    };
  }
  if (!obj.visualPresets) {
    obj.visualPresets = {
      situation: 'idle_disconnected',
      presets: {},
      transitionDurations: {},
    };
  }
  if (!obj.meta) {
    obj.meta = { name: 'unknown', createdAt: new Date().toISOString() };
  }

  // Strip legacy neon data from old saves (no longer used)
  delete obj.neonBands;
  const instances = obj.instances as Array<{ type: string }> | undefined;
  if (instances) {
    obj.instances = instances.filter(inst => inst.type !== 'neon');
  }

  return data as SceneSaveFile;
}
