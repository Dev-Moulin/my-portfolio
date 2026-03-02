import type {
  BloomSnapshot,
  LightingSnapshot,
  MaterialSnapshot,
  SceneSnapshot,
  InstanceSnapshot,
} from './UndoRedoManager.ts';
import type { ModelSettings } from '../scene/types.ts';
import type { NeonBandsContext } from '../machines/neonBandsMachine.ts';
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
  neonBands: NeonBandsContext;
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
  'neonBands', 'scene', 'steering', 'timeline', 'instances',
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

  // Cylinder mode defaults for neonBands (retrocompat with old saves)
  const neon = obj.neonBands as Record<string, unknown> | undefined;
  if (neon && neon.cylinderMode === undefined) {
    neon.cylinderMode = false;
    neon.cylinderRadius = 5;
    neon.cylinderCopies = 1;
    neon.cylinderAutoFill = false;
    neon.cylinderDirection = 'outward';
  }

  // Cylinder mode defaults for neon instances
  const instances = obj.instances as Array<{ type: string; config: Record<string, unknown> }> | undefined;
  if (instances) {
    for (const inst of instances) {
      if (inst.type === 'neon' && inst.config && inst.config.cylinderMode === undefined) {
        inst.config.cylinderMode = false;
        inst.config.cylinderRadius = 5;
        inst.config.cylinderCopies = 1;
        inst.config.cylinderAutoFill = false;
        inst.config.cylinderDirection = 'outward';
      }
    }
  }

  return data as SceneSaveFile;
}
