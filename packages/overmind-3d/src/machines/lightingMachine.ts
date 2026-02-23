import { setup, assign } from 'xstate';
import type * as THREE from 'three';
import { LIGHT_POSITION_PRESETS } from '../utils/lightPresets.ts';
import type { PresetKey } from '../utils/lightPresets.ts';

export interface LightingContext {
  ambientLight: THREE.AmbientLight | null;
  directionalLight: THREE.DirectionalLight | null;
  pointLight: THREE.PointLight | null;
  ambientIntensity: number;
  directionalIntensity: number;
  pointIntensity: number;
  renderer: THREE.WebGLRenderer | null;
  exposure: number;
  hdrBoostEnabled: boolean;
  hdrBoostMultiplier: number;
  directionalPosition: { x: number; y: number; z: number };
  currentPreset: string;
}

export type LightingEvents =
  | { type: 'SET_LIGHTS'; ambientLight: THREE.AmbientLight; directionalLight: THREE.DirectionalLight; pointLight: THREE.PointLight }
  | { type: 'SET_RENDERER'; renderer: THREE.WebGLRenderer }
  | { type: 'UPDATE_AMBIENT_INTENSITY'; intensity: number }
  | { type: 'UPDATE_DIRECTIONAL_INTENSITY'; intensity: number }
  | { type: 'UPDATE_POINT_INTENSITY'; intensity: number }
  | { type: 'UPDATE_EXPOSURE'; exposure: number }
  | { type: 'TOGGLE_HDR_BOOST' }
  | { type: 'UPDATE_HDR_MULTIPLIER'; multiplier: number }
  | { type: 'UPDATE_DIRECTIONAL_POSITION'; position: { x: number; y: number; z: number } }
  | { type: 'APPLY_LIGHT_PRESET'; preset: PresetKey };

export const lightingMachine = setup({
  types: {} as {
    context: LightingContext;
    events: LightingEvents;
  },
  actions: {
    updateAmbientLight: ({ context }) => {
      if (context.ambientLight) context.ambientLight.intensity = context.ambientIntensity;
    },
    updateDirectionalLight: ({ context }) => {
      if (context.directionalLight) context.directionalLight.intensity = context.directionalIntensity;
    },
    updatePointLight: ({ context }) => {
      if (context.pointLight) context.pointLight.intensity = context.pointIntensity;
    },
    updateExposure: ({ context }) => {
      if (context.renderer) {
        const finalExposure = context.hdrBoostEnabled
          ? context.exposure * context.hdrBoostMultiplier
          : context.exposure;
        context.renderer.toneMappingExposure = finalExposure;
      }
    },
    updateDirectionalPosition: ({ context }) => {
      if (context.directionalLight) {
        const { x, y, z } = context.directionalPosition;
        context.directionalLight.position.set(x, y, z);
      }
    },
  },
}).createMachine({
  id: 'lighting',
  context: {
    ambientLight: null,
    directionalLight: null,
    pointLight: null,
    ambientIntensity: 0.5,
    directionalIntensity: 2.0,
    pointIntensity: 2.0,
    renderer: null,
    exposure: 1.0,
    hdrBoostEnabled: false,
    hdrBoostMultiplier: 2.0,
    directionalPosition: { x: 1, y: 2, z: 3 },
    currentPreset: 'studio-classic',
  },
  on: {
    SET_LIGHTS: {
      actions: [
        assign({
          ambientLight: ({ event }) => event.ambientLight,
          directionalLight: ({ event }) => event.directionalLight,
          pointLight: ({ event }) => event.pointLight,
        }),
        'updateAmbientLight',
        'updateDirectionalLight',
        'updatePointLight',
        'updateDirectionalPosition',
      ],
    },
    SET_RENDERER: {
      actions: [
        assign({ renderer: ({ event }) => event.renderer }),
        'updateExposure',
      ],
    },
    UPDATE_AMBIENT_INTENSITY: {
      actions: [
        assign({ ambientIntensity: ({ event }) => event.intensity }),
        'updateAmbientLight',
      ],
    },
    UPDATE_DIRECTIONAL_INTENSITY: {
      actions: [
        assign({ directionalIntensity: ({ event }) => event.intensity }),
        'updateDirectionalLight',
      ],
    },
    UPDATE_POINT_INTENSITY: {
      actions: [
        assign({ pointIntensity: ({ event }) => event.intensity }),
        'updatePointLight',
      ],
    },
    UPDATE_EXPOSURE: {
      actions: [
        assign({ exposure: ({ event }) => event.exposure }),
        'updateExposure',
      ],
    },
    TOGGLE_HDR_BOOST: {
      actions: [
        assign({ hdrBoostEnabled: ({ context }) => !context.hdrBoostEnabled }),
        'updateExposure',
      ],
    },
    UPDATE_HDR_MULTIPLIER: {
      actions: [
        assign({ hdrBoostMultiplier: ({ event }) => event.multiplier }),
        'updateExposure',
      ],
    },
    UPDATE_DIRECTIONAL_POSITION: {
      actions: [
        assign({ directionalPosition: ({ event }) => event.position }),
        'updateDirectionalPosition',
      ],
    },
    APPLY_LIGHT_PRESET: {
      actions: [
        assign(({ event }) => {
          const preset = LIGHT_POSITION_PRESETS[event.preset];
          return {
            directionalPosition: preset.position,
            currentPreset: event.preset as string,
          };
        }),
        'updateDirectionalPosition',
      ],
    },
  },
});
