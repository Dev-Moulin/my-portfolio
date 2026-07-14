import { setup, assign } from 'xstate';
import type * as THREE from 'three';
import type { ComponentRegistry } from '../scene/componentRegistry.ts';
import type { ComponentContext } from '../scene/componentDescriptor.ts';
import { LIGHT_POSITION_PRESETS } from '../utils/lightPresets.ts';
import type { PresetKey } from '../utils/lightPresets.ts';

// ── Types ────────────────────────────────────────────────────────────────────

type Vec3 = { x: number; y: number; z: number };

export interface LightEntry {
  id: string;
  lightType: 'point' | 'directional' | 'spot' | 'area';
  power: number;
  color: string;
  position: Vec3;
  rotation: Vec3;
  distance: number;
  decay: number;
  angle?: number;
  penumbra?: number;
  areaWidth?: number;
  areaHeight?: number;
  volumetric?: boolean;
  trackToTargetId?: string;
  trackToMaintainDistance?: boolean;
  trackToFollowPosition?: boolean;
  isDefault?: boolean;
}

export interface SunShaderState {
  colorCore: string;
  colorMid: string;
  colorEdge: string;
  emissiveStrength: number;
  displaceStrength: number;
  pulseSpeed: number;
}

export interface EnvironmentState {
  ambientIntensity: number;
  ambientColor: string;
  exposure: number;
  hdrBoostEnabled: boolean;
  hdrBoostMultiplier: number;
  currentPreset: string;
  sun: SunShaderState;
}

export interface LightsSnapshot {
  environment: EnvironmentState;
  lights: LightEntry[];
}

export interface LightsContext {
  environment: EnvironmentState;
  lights: Map<string, LightEntry>;
  // Three.js refs (injected via INIT, not serializable)
  renderer: THREE.WebGLRenderer | null;
  ambientLight: THREE.AmbientLight | null;
  componentRegistry: ComponentRegistry | null;
  componentCtx: ComponentContext | null;
  sunMat: THREE.ShaderMaterial | null;
  // Internal counter for generating unique IDs
  nextIdCounter: number;
}

export type LightsEvents =
  | { type: 'INIT'; renderer: THREE.WebGLRenderer; ambientLight: THREE.AmbientLight; registry: ComponentRegistry; ctx: ComponentContext }
  | { type: 'CREATE_DEFAULT_LIGHTS' }
  // Environment
  | { type: 'SET_AMBIENT'; intensity?: number; color?: string }
  | { type: 'SET_EXPOSURE'; value: number }
  | { type: 'TOGGLE_HDR_BOOST' }
  | { type: 'SET_HDR_MULTIPLIER'; value: number }
  | { type: 'APPLY_PRESET'; preset: PresetKey }
  // Lights CRUD
  | { type: 'ADD_LIGHT'; entry: Omit<LightEntry, 'id'>; id?: string }
  | { type: 'REMOVE_LIGHT'; id: string }
  | { type: 'UPDATE_LIGHT'; id: string; patch: Partial<LightEntry> }
  | { type: 'SYNC_TRANSFORM'; id: string; position: Vec3; rotation: Vec3 }
  // Undo/Save
  | { type: 'RESTORE'; snapshot: LightsSnapshot }
  // Compat: direct intensity update (used by timeline bridge for visual keyframes)
  | { type: 'UPDATE_LIGHT_INTENSITY'; id: string; intensity: number }
  // Sun shader
  | { type: 'SET_SUN_MAT'; mat: THREE.ShaderMaterial }
  | { type: 'UPDATE_SUN'; patch: Partial<SunShaderState> };

// ── Conversion power → Three.js intensity ─────────────────────────────────

export function powerToIntensity(
  lightType: string,
  power: number,
  config?: Partial<LightEntry>,
): number {
  switch (lightType) {
    case 'point': return power / (4 * Math.PI);
    case 'spot': return power / Math.PI;
    case 'directional': return power; // lux, no conversion
    case 'area': return power / ((config?.areaWidth ?? 2) * (config?.areaHeight ?? 2));
    default: return power;
  }
}

export function intensityToPower(
  lightType: string,
  intensity: number,
  config?: Partial<LightEntry>,
): number {
  switch (lightType) {
    case 'point': return intensity * (4 * Math.PI);
    case 'spot': return intensity * Math.PI;
    case 'directional': return intensity;
    case 'area': return intensity * ((config?.areaWidth ?? 2) * (config?.areaHeight ?? 2));
    default: return intensity;
  }
}

// ── Helper: build registry config from LightEntry ─────────────────────────

function entryToRegistryConfig(entry: LightEntry | Omit<LightEntry, 'id'>) {
  return {
    lightType: entry.lightType,
    color: entry.color,
    intensity: powerToIntensity(entry.lightType, entry.power, entry),
    positionX: entry.position.x,
    positionY: entry.position.y,
    positionZ: entry.position.z,
    rotationX: entry.rotation.x,
    rotationY: entry.rotation.y,
    rotationZ: entry.rotation.z,
    distance: entry.distance,
    decay: entry.decay,
    angle: entry.angle,
    penumbra: entry.penumbra,
    areaWidth: entry.areaWidth,
    areaHeight: entry.areaHeight,
    volumetric: entry.volumetric,
    trackToTargetId: entry.trackToTargetId,
    trackToMaintainDistance: entry.trackToMaintainDistance,
    trackToFollowPosition: entry.trackToFollowPosition,
  };
}

// ── Machine ──────────────────────────────────────────────────────────────────

export const lightsMachine = setup({
  types: {} as {
    context: LightsContext;
    events: LightsEvents;
  },
  actions: {
    syncAmbient: ({ context }) => {
      if (context.ambientLight) {
        context.ambientLight.intensity = context.environment.ambientIntensity;
        context.ambientLight.color.set(context.environment.ambientColor);
      }
    },
    syncExposure: ({ context }) => {
      if (context.renderer) {
        const env = context.environment;
        context.renderer.toneMappingExposure = env.hdrBoostEnabled
          ? env.exposure * env.hdrBoostMultiplier
          : env.exposure;
      }
    },
  },
}).createMachine({
  id: 'lights',
  context: {
    environment: {
      ambientIntensity: 0,
      ambientColor: '#ffffff',
      exposure: 1.0,
      hdrBoostEnabled: false,
      hdrBoostMultiplier: 2.0,
      currentPreset: 'studio-classic',
      sun: {
        colorCore: '#fff8e0',
        colorMid: '#ffaa22',
        colorEdge: '#ff4400',
        emissiveStrength: 3.0,
        displaceStrength: 0.15,
        pulseSpeed: 1.5,
      },
    },
    lights: new Map(),
    renderer: null,
    ambientLight: null,
    componentRegistry: null,
    componentCtx: null,
    sunMat: null,
    nextIdCounter: 1,
  },
  on: {
    // ── Init ───────────────────────────────────────────────────────────
    INIT: {
      actions: [
        assign({
          renderer: ({ event }) => event.renderer,
          ambientLight: ({ event }) => event.ambientLight,
          componentRegistry: ({ event }) => event.registry,
          componentCtx: ({ event }) => event.ctx,
        }),
        'syncAmbient',
        'syncExposure',
      ],
    },

    CREATE_DEFAULT_LIGHTS: {
      actions: ({ context }) => {
        const { componentRegistry: reg, componentCtx: ctx } = context;
        if (!reg || !ctx) return;

        // Valeurs réglées par l'utilisateur dans le LightingTab (Power (W) + width), ambient=0.
        // Power (W) = "exposure" dans son vocabulaire ; intensité = power / (width × height).
        const defaultAreas: LightEntry[] = [
          {
            id: 'area_left', lightType: 'area', power: 4600, color: '#ffffff',
            position: { x: -9.76, y: -8.31, z: -7.68 },
            rotation: { x: 1.571, y: -1.079, z: 1.571 },
            distance: 0, decay: 2, areaWidth: 200, areaHeight: 2.1,
          },
          {
            id: 'area_right', lightType: 'area', power: 4600, color: '#ffffff',
            position: { x: 51.64, y: -8.31, z: -7.68 },
            rotation: { x: 1.571, y: 1.048, z: 1.571 },
            distance: 0, decay: 2, areaWidth: 200, areaHeight: 2.1,
          },
          {
            id: 'area_top', lightType: 'area', power: 1500, color: '#ffffff',
            position: { x: 39.48, y: 35.12, z: -7.68 },
            rotation: { x: -1.571, y: 0.682, z: -1.57 },
            distance: 0, decay: 2, areaWidth: 200, areaHeight: 0.6,
          },
        ];

        for (const entry of defaultAreas) {
          reg.create('light', 'light', entryToRegistryConfig(entry), ctx, entry.id);
          context.lights.set(entry.id, entry);
        }
      },
    },

    // ── Environment ────────────────────────────────────────────────────
    SET_AMBIENT: {
      actions: [
        assign({
          environment: ({ context, event }) => ({
            ...context.environment,
            ...(event.intensity !== undefined && { ambientIntensity: event.intensity }),
            ...(event.color !== undefined && { ambientColor: event.color }),
          }),
        }),
        'syncAmbient',
      ],
    },

    SET_EXPOSURE: {
      actions: [
        assign({
          environment: ({ context, event }) => ({
            ...context.environment,
            exposure: event.value,
          }),
        }),
        'syncExposure',
      ],
    },

    TOGGLE_HDR_BOOST: {
      actions: [
        assign({
          environment: ({ context }) => ({
            ...context.environment,
            hdrBoostEnabled: !context.environment.hdrBoostEnabled,
          }),
        }),
        'syncExposure',
      ],
    },

    SET_HDR_MULTIPLIER: {
      actions: [
        assign({
          environment: ({ context, event }) => ({
            ...context.environment,
            hdrBoostMultiplier: event.value,
          }),
        }),
        'syncExposure',
      ],
    },

    APPLY_PRESET: {
      actions: [
        assign({
          environment: ({ context, event }) => ({
            ...context.environment,
            currentPreset: event.preset as string,
          }),
        }),
        ({ context, event }) => {
          const preset = LIGHT_POSITION_PRESETS[event.preset];
          if (!preset) return;
          // Move default directional to preset position
          const dirEntry = context.lights.get('dirLight');
          if (dirEntry && context.componentRegistry) {
            dirEntry.position = { ...preset.position };
            context.componentRegistry.applyConfig('dirLight', {
              positionX: preset.position.x,
              positionY: preset.position.y,
              positionZ: preset.position.z,
            });
          }
        },
      ],
    },

    // ── Sun shader ──────────────────────────────────────────────────────
    SET_SUN_MAT: {
      actions: assign({ sunMat: ({ event }) => event.mat }),
    },

    UPDATE_SUN: {
      actions: [
        assign({
          environment: ({ context, event }) => ({
            ...context.environment,
            sun: { ...context.environment.sun, ...event.patch },
          }),
        }),
        ({ context, event }) => {
          const mat = context.sunMat;
          if (!mat) return;
          const p = event.patch;
          if (p.colorCore !== undefined) mat.uniforms['uColorCore'].value.set(p.colorCore);
          if (p.colorMid !== undefined) mat.uniforms['uColorMid'].value.set(p.colorMid);
          if (p.colorEdge !== undefined) mat.uniforms['uColorEdge'].value.set(p.colorEdge);
          if (p.emissiveStrength !== undefined) mat.uniforms['uEmissiveStrength'].value = p.emissiveStrength;
          if (p.displaceStrength !== undefined) mat.uniforms['uDisplaceStrength'].value = p.displaceStrength;
          if (p.pulseSpeed !== undefined) mat.uniforms['uPulseSpeed'].value = p.pulseSpeed;
        },
      ],
    },

    // ── Lights CRUD ────────────────────────────────────────────────────
    ADD_LIGHT: {
      actions: ({ context, event }) => {
        const { componentRegistry: reg, componentCtx: ctx } = context;
        if (!reg || !ctx) return;

        const id = event.id ?? `light_${context.nextIdCounter++}`;
        const entry: LightEntry = { ...event.entry, id } as LightEntry;
        context.lights.set(id, entry);
        reg.create('light', 'light', entryToRegistryConfig(entry), ctx, id);
      },
    },

    REMOVE_LIGHT: {
      actions: ({ context, event }) => {
        const entry = context.lights.get(event.id);
        if (!entry) return;
        context.lights.delete(event.id);
        if (context.componentRegistry && context.componentCtx) {
          context.componentRegistry.disposeOne(event.id, context.componentCtx);
        }
      },
    },

    UPDATE_LIGHT: {
      actions: ({ context, event }) => {
        const entry = context.lights.get(event.id);
        if (!entry) return;

        // Merge patch into entry
        const patch = event.patch;
        if (patch.power !== undefined) entry.power = patch.power;
        if (patch.color !== undefined) entry.color = patch.color;
        if (patch.position !== undefined) entry.position = { ...patch.position };
        if (patch.rotation !== undefined) entry.rotation = { ...patch.rotation };
        if (patch.distance !== undefined) entry.distance = patch.distance;
        if (patch.decay !== undefined) entry.decay = patch.decay;
        if (patch.angle !== undefined) entry.angle = patch.angle;
        if (patch.penumbra !== undefined) entry.penumbra = patch.penumbra;
        if (patch.areaWidth !== undefined) entry.areaWidth = patch.areaWidth;
        if (patch.areaHeight !== undefined) entry.areaHeight = patch.areaHeight;
        if (patch.volumetric !== undefined) entry.volumetric = patch.volumetric;
        if (patch.trackToTargetId !== undefined) entry.trackToTargetId = patch.trackToTargetId;
        if (patch.trackToMaintainDistance !== undefined) entry.trackToMaintainDistance = patch.trackToMaintainDistance;
        if (patch.trackToFollowPosition !== undefined) entry.trackToFollowPosition = patch.trackToFollowPosition;

        // Build registry patch (convert power to intensity if needed)
        const regPatch: Record<string, unknown> = {};
        if (patch.power !== undefined) {
          regPatch.intensity = powerToIntensity(entry.lightType, entry.power, entry);
        }
        if (patch.color !== undefined) regPatch.color = patch.color;
        if (patch.position !== undefined) {
          regPatch.positionX = patch.position.x;
          regPatch.positionY = patch.position.y;
          regPatch.positionZ = patch.position.z;
        }
        if (patch.rotation !== undefined) {
          regPatch.rotationX = patch.rotation.x;
          regPatch.rotationY = patch.rotation.y;
          regPatch.rotationZ = patch.rotation.z;
        }
        if (patch.distance !== undefined) regPatch.distance = patch.distance;
        if (patch.decay !== undefined) regPatch.decay = patch.decay;
        if (patch.angle !== undefined) regPatch.angle = patch.angle;
        if (patch.penumbra !== undefined) regPatch.penumbra = patch.penumbra;
        if (patch.areaWidth !== undefined) regPatch.areaWidth = patch.areaWidth;
        if (patch.areaHeight !== undefined) regPatch.areaHeight = patch.areaHeight;
        if (patch.volumetric !== undefined) regPatch.volumetric = patch.volumetric;
        if (patch.trackToTargetId !== undefined) regPatch.trackToTargetId = patch.trackToTargetId;
        if (patch.trackToMaintainDistance !== undefined) regPatch.trackToMaintainDistance = patch.trackToMaintainDistance;
        if (patch.trackToFollowPosition !== undefined) regPatch.trackToFollowPosition = patch.trackToFollowPosition;

        if (Object.keys(regPatch).length > 0 && context.componentRegistry) {
          context.componentRegistry.applyConfig(event.id, regPatch);
        }
      },
    },

    // Direct intensity update (bypass power conversion, used by timeline VK compat)
    UPDATE_LIGHT_INTENSITY: {
      actions: ({ context, event }) => {
        const entry = context.lights.get(event.id);
        if (!entry) return;
        // Update power from the intensity value (reverse conversion)
        entry.power = intensityToPower(entry.lightType, event.intensity, entry);
        if (context.componentRegistry) {
          context.componentRegistry.applyConfig(event.id, { intensity: event.intensity });
        }
      },
    },

    SYNC_TRANSFORM: {
      actions: assign({
        lights: ({ context, event }) => {
          const entry = context.lights.get(event.id);
          if (entry) {
            entry.position = { ...event.position };
            entry.rotation = { ...event.rotation };
          }
          return context.lights;
        },
      }),
    },

    // ── Restore (undo/redo/load) ───────────────────────────────────────
    RESTORE: {
      actions: [
        ({ context, event }) => {
          const { componentRegistry: reg, componentCtx: ctx } = context;
          if (!reg || !ctx) return;

          // Remove lights not in snapshot
          for (const id of context.lights.keys()) {
            if (!event.snapshot.lights.find(e => e.id === id)) {
              reg.disposeOne(id, ctx);
            }
          }

          // Clear and rebuild from snapshot
          context.lights.clear();
          for (const entry of event.snapshot.lights) {
            context.lights.set(entry.id, { ...entry });
            if (reg.has(entry.id)) {
              // Update existing
              reg.applyConfig(entry.id, entryToRegistryConfig(entry));
            } else {
              // Create new
              reg.create('light', 'light', entryToRegistryConfig(entry), ctx, entry.id);
            }
          }
        },
        assign({
          environment: ({ event }) => ({ ...event.snapshot.environment }),
        }),
        'syncAmbient',
        'syncExposure',
      ],
    },
  },
});
