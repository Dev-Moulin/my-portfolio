import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { lightsMachine, LightEntry } from '../machines/lightsMachine.ts';
import { powerToIntensity } from '../machines/lightsMachine.ts';
import type { PresetKey } from '../utils/lightPresets.ts';

type LightsActor = ActorRefFrom<typeof lightsMachine>;

export function useLights(actorRef: LightsActor | null | undefined) {
  const environment = useSelector(actorRef ?? undefined, (s) => s?.context.environment);
  const lights = useSelector(actorRef ?? undefined, (s) => s?.context.lights) as Map<string, LightEntry> | undefined;

  const dirLight = lights?.get('dirLight');
  const pointLight = lights?.get('pointLight');

  return {
    // ── Environment (read) ─────────────────────────────────────────────
    ambientIntensity: environment?.ambientIntensity ?? 4,
    ambientColor: environment?.ambientColor ?? '#ffffff',
    exposure: environment?.exposure ?? 1.0,
    hdrBoostEnabled: environment?.hdrBoostEnabled ?? false,
    hdrBoostMultiplier: environment?.hdrBoostMultiplier ?? 2.0,
    currentPreset: (environment?.currentPreset ?? 'studio-classic') as string,

    // ── Legacy compat (for visual keyframe capture) ────────────────────
    directionalIntensity: dirLight ? powerToIntensity(dirLight.lightType, dirLight.power, dirLight) : 2.0,
    pointIntensity: pointLight ? powerToIntensity(pointLight.lightType, pointLight.power, pointLight) : 2.0,
    directionalPosition: dirLight?.position ?? { x: 1, y: 2, z: 3 },

    // ── Legacy actions compat ──────────────────────────────────────────
    updateAmbientIntensity: (intensity: number) =>
      actorRef?.send({ type: 'SET_AMBIENT', intensity }),
    updateDirectionalIntensity: (intensity: number) =>
      actorRef?.send({ type: 'UPDATE_LIGHT_INTENSITY', id: 'dirLight', intensity }),
    updatePointIntensity: (intensity: number) =>
      actorRef?.send({ type: 'UPDATE_LIGHT_INTENSITY', id: 'pointLight', intensity }),
    updateExposure: (value: number) =>
      actorRef?.send({ type: 'SET_EXPOSURE', value }),
    updateDirectionalPosition: (position: { x: number; y: number; z: number }) =>
      actorRef?.send({ type: 'UPDATE_LIGHT', id: 'dirLight', patch: { position } }),
    applyLightPreset: (preset: PresetKey) =>
      actorRef?.send({ type: 'APPLY_PRESET', preset }),

    // ── Lights (read) ──────────────────────────────────────────────────
    lights: lights ?? new Map<string, LightEntry>(),
    getLightById: (id: string): LightEntry | undefined => (lights as Map<string, LightEntry> | undefined)?.get(id),

    // ── Environment (actions) ──────────────────────────────────────────
    setAmbient: (patch: { intensity?: number; color?: string }) =>
      actorRef?.send({ type: 'SET_AMBIENT', ...patch }),
    setExposure: (value: number) =>
      actorRef?.send({ type: 'SET_EXPOSURE', value }),
    toggleHDRBoost: () =>
      actorRef?.send({ type: 'TOGGLE_HDR_BOOST' }),
    setHDRMultiplier: (value: number) =>
      actorRef?.send({ type: 'SET_HDR_MULTIPLIER', value }),
    applyPreset: (preset: PresetKey) =>
      actorRef?.send({ type: 'APPLY_PRESET', preset }),

    // ── Lights CRUD (actions) ──────────────────────────────────────────
    addLight: (entry: Omit<LightEntry, 'id'>, id?: string) =>
      actorRef?.send({ type: 'ADD_LIGHT', entry, id }),
    removeLight: (id: string) =>
      actorRef?.send({ type: 'REMOVE_LIGHT', id }),
    updateLight: (id: string, patch: Partial<LightEntry>) =>
      actorRef?.send({ type: 'UPDATE_LIGHT', id, patch }),
  };
}
