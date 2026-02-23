import { setup, assign } from 'xstate';
import type * as THREE from 'three';
import { TONE_MAPPING_MAP } from '../utils/toneMappingMap.ts';
import type { ToneMappingType } from '../utils/toneMappingMap.ts';
import { PBR_PRESETS } from '../utils/pbrPresets.ts';
import type { PBRPresetKey } from '../utils/pbrPresets.ts';

export type PBRGroup = 'eyeRings' | 'iris' | 'magicRings' | 'arms';

export interface PBRGroupConfig {
  materials: THREE.Material[] | null;
  metalness: number;
  roughness: number;
}

export interface PBRContext {
  renderer: THREE.WebGLRenderer | null;
  toneMapping: ToneMappingType;
  groups: {
    eyeRings: PBRGroupConfig;
    iris: PBRGroupConfig;
    magicRings: PBRGroupConfig;
    arms: PBRGroupConfig;
  };
  currentPreset: PBRPresetKey | null;
}

export type PBREvents =
  | { type: 'SET_RENDERER'; renderer: THREE.WebGLRenderer }
  | { type: 'SET_GROUP_MATERIALS'; group: PBRGroup; materials: THREE.Material[] }
  | { type: 'SET_TONE_MAPPING'; toneMapping: ToneMappingType }
  | { type: 'UPDATE_GROUP_METALNESS'; group: PBRGroup; metalness: number }
  | { type: 'UPDATE_GROUP_ROUGHNESS'; group: PBRGroup; roughness: number }
  | { type: 'APPLY_PRESET_TO_GROUP'; group: PBRGroup; preset: PBRPresetKey }
  | { type: 'RESTORE_DEFAULTS' };

export const pbrMachine = setup({
  types: {} as {
    context: PBRContext;
    events: PBREvents;
  },
  actions: {
    applyToneMapping: ({ context }) => {
      if (context.renderer) {
        context.renderer.toneMapping = TONE_MAPPING_MAP[context.toneMapping];
      }
    },
    applyGroupMetalness: ({ context, event }) => {
      if (event.type === 'UPDATE_GROUP_METALNESS') {
        const group = context.groups[event.group];
        if (group.materials) {
          group.materials.forEach((material) => {
            if ('metalness' in material) {
              (material as THREE.MeshStandardMaterial).metalness = event.metalness;
              material.needsUpdate = true;
            }
          });
        }
      }
    },
    applyGroupRoughness: ({ context, event }) => {
      if (event.type === 'UPDATE_GROUP_ROUGHNESS') {
        const group = context.groups[event.group];
        if (group.materials) {
          group.materials.forEach((material) => {
            if ('roughness' in material) {
              (material as THREE.MeshStandardMaterial).roughness = event.roughness;
              material.needsUpdate = true;
            }
          });
        }
      }
    },
    applyPresetToGroup: ({ context, event }) => {
      if (event.type === 'APPLY_PRESET_TO_GROUP') {
        const preset = PBR_PRESETS[event.preset];
        const group = context.groups[event.group];
        if (group.materials) {
          group.materials.forEach((material) => {
            if ('metalness' in material && 'roughness' in material) {
              const mat = material as THREE.MeshStandardMaterial;
              mat.metalness = preset.metalness;
              mat.roughness = preset.roughness;
              material.needsUpdate = true;
            }
          });
        }
      }
    },
  },
}).createMachine({
  id: 'pbr',
  context: {
    renderer: null,
    toneMapping: 'ACESFilmicToneMapping' as ToneMappingType,
    groups: {
      eyeRings: { materials: null, metalness: 0, roughness: 0.5 },
      iris: { materials: null, metalness: 0.5, roughness: 0.5 },
      magicRings: { materials: null, metalness: 0.5, roughness: 0.5 },
      arms: { materials: null, metalness: 0.5, roughness: 0.5 },
    },
    currentPreset: null,
  },
  on: {
    SET_RENDERER: {
      actions: [
        assign({ renderer: ({ event }) => event.renderer }),
        'applyToneMapping',
      ],
    },
    SET_GROUP_MATERIALS: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            ...context.groups,
            [event.group]: {
              ...context.groups[event.group],
              materials: event.materials,
            },
          }),
        }),
        ({ context, event }) => {
          const group = context.groups[event.group];
          if (group.materials) {
            group.materials.forEach((material) => {
              if ('metalness' in material && 'roughness' in material) {
                const mat = material as THREE.MeshStandardMaterial;
                mat.metalness = group.metalness;
                mat.roughness = group.roughness;
                material.needsUpdate = true;
              }
            });
          }
        },
      ],
    },
    SET_TONE_MAPPING: {
      actions: [
        assign({ toneMapping: ({ event }) => event.toneMapping }),
        'applyToneMapping',
      ],
    },
    UPDATE_GROUP_METALNESS: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            ...context.groups,
            [event.group]: {
              ...context.groups[event.group],
              metalness: event.metalness,
            },
          }),
        }),
        'applyGroupMetalness',
      ],
    },
    UPDATE_GROUP_ROUGHNESS: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            ...context.groups,
            [event.group]: {
              ...context.groups[event.group],
              roughness: event.roughness,
            },
          }),
        }),
        'applyGroupRoughness',
      ],
    },
    APPLY_PRESET_TO_GROUP: {
      actions: [
        assign({
          groups: ({ context, event }) => {
            const preset = PBR_PRESETS[event.preset];
            return {
              ...context.groups,
              [event.group]: {
                ...context.groups[event.group],
                metalness: preset.metalness,
                roughness: preset.roughness,
              },
            };
          },
          currentPreset: ({ event }) => event.preset as PBRPresetKey,
        }),
        'applyPresetToGroup',
      ],
    },
    RESTORE_DEFAULTS: {
      actions: [
        assign({
          toneMapping: 'ACESFilmicToneMapping' as ToneMappingType,
          currentPreset: null,
        }),
        'applyToneMapping',
      ],
    },
  },
});
