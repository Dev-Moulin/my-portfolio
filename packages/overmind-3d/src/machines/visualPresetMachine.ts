import { setup, assign } from 'xstate';
import type { Situation, VisualPreset } from '../data/defaultPresets.ts';
import {
  DEFAULT_PRESETS,
  DEFAULT_TRANSITION_DURATIONS,
  getTransitionDuration,
} from '../data/defaultPresets.ts';
import { easeInOutCubic } from '../utils/easingFunctions.ts';
import { lerpColor } from '../utils/colorInterpolation.ts';

/** Deep-merge only the defined keys of `partial` into `base` */
function mergePreset(base: VisualPreset, partial: VisualPreset): VisualPreset {
  const result: VisualPreset = structuredClone(base);
  if (partial.bloom) result.bloom = { ...result.bloom, ...partial.bloom };
  if (partial.lighting) result.lighting = { ...result.lighting, ...partial.lighting };
  if (partial.material) {
    if (!result.material) result.material = {};
    if (partial.material.iris) result.material.iris = { ...result.material.iris, ...partial.material.iris };
    if (partial.material.eyeRings) result.material.eyeRings = { ...result.material.eyeRings, ...partial.material.eyeRings };
    if (partial.material.revealRings) result.material.revealRings = { ...result.material.revealRings, ...partial.material.revealRings };
  }
  if (partial.pbr) {
    if (!result.pbr) result.pbr = {};
    if (partial.pbr.eyeRings) result.pbr.eyeRings = { ...result.pbr.eyeRings, ...partial.pbr.eyeRings };
    if (partial.pbr.iris) result.pbr.iris = { ...result.pbr.iris, ...partial.pbr.iris };
    if (partial.pbr.magicRings) result.pbr.magicRings = { ...result.pbr.magicRings, ...partial.pbr.magicRings };
    if (partial.pbr.arms) result.pbr.arms = { ...result.pbr.arms, ...partial.pbr.arms };
  }
  return result;
}

/** Interpolate defined numeric fields; colors via HSL */
function interpolatePreset(from: VisualPreset, to: VisualPreset, t: number): VisualPreset {
  const result: VisualPreset = structuredClone(from);
  const eased = easeInOutCubic(t);

  const lerpNum = (a: number | undefined, b: number | undefined): number | undefined => {
    if (a === undefined || b === undefined) return b ?? a;
    return a + (b - a) * eased;
  };

  const lerpCol = (a: string | undefined, b: string | undefined): string | undefined => {
    if (!a || !b) return b ?? a;
    return lerpColor(a, b, eased);
  };

  if (from.bloom && to.bloom) {
    result.bloom = {
      color: lerpCol(from.bloom.color, to.bloom.color),
      strength: lerpNum(from.bloom.strength, to.bloom.strength),
      threshold: lerpNum(from.bloom.threshold, to.bloom.threshold),
      radius: lerpNum(from.bloom.radius, to.bloom.radius),
    };
  } else if (to.bloom) {
    result.bloom = to.bloom;
  }

  if (from.lighting && to.lighting) {
    result.lighting = {
      ambientIntensity: lerpNum(from.lighting.ambientIntensity, to.lighting.ambientIntensity),
      directionalIntensity: lerpNum(from.lighting.directionalIntensity, to.lighting.directionalIntensity),
      pointIntensity: lerpNum(from.lighting.pointIntensity, to.lighting.pointIntensity),
      exposure: lerpNum(from.lighting.exposure, to.lighting.exposure),
      hdrBoostMultiplier: lerpNum(from.lighting.hdrBoostMultiplier, to.lighting.hdrBoostMultiplier),
    };
  } else if (to.lighting) {
    result.lighting = to.lighting;
  }

  if (to.material) {
    if (!result.material) result.material = {};
    for (const group of ['iris', 'eyeRings', 'revealRings'] as const) {
      const fg = from.material?.[group];
      const tg = to.material?.[group];
      if (fg && tg) {
        result.material[group] = {
          emissiveColor: lerpCol(fg.emissiveColor, tg.emissiveColor),
          emissiveIntensity: lerpNum(fg.emissiveIntensity, tg.emissiveIntensity),
        };
      } else if (tg) {
        result.material[group] = tg;
      }
    }
  }

  if (to.pbr) {
    if (!result.pbr) result.pbr = {};
    for (const group of ['eyeRings', 'iris', 'magicRings', 'arms'] as const) {
      const fg = from.pbr?.[group];
      const tg = to.pbr?.[group];
      if (fg && tg) {
        result.pbr[group] = {
          metalness: lerpNum(fg.metalness, tg.metalness),
          roughness: lerpNum(fg.roughness, tg.roughness),
        };
      } else if (tg) {
        result.pbr[group] = tg;
      }
    }
  }

  return result;
}

export interface VisualPresetContext {
  situation: Situation;
  previousSituation: Situation;
  presets: Record<Situation, VisualPreset>;
  transitionDurations: Record<string, number>;
  isTransitioning: boolean;
  transitionProgress: number;
  transitionDuration: number;
  startValues: VisualPreset;
  targetValues: VisualPreset;
  currentValues: VisualPreset;
}

export type VisualPresetEvents =
  | { type: 'SET_SITUATION'; situation: Situation }
  | { type: 'TICK'; delta: number }
  | { type: 'UPDATE_PRESET'; situation: Situation; preset: VisualPreset }
  | { type: 'SAVE_CURRENT_AS_PRESET'; situation: Situation; values: VisualPreset }
  | { type: 'LOAD_PRESETS'; presets: Record<Situation, VisualPreset>; durations?: Record<string, number> }
  | { type: 'RESTORE_DEFAULTS' };

export const visualPresetMachine = setup({
  types: {} as {
    context: VisualPresetContext;
    events: VisualPresetEvents;
  },
}).createMachine({
  id: 'visualPreset',
  context: {
    situation: 'idle_disconnected' as Situation,
    previousSituation: 'idle_disconnected' as Situation,
    presets: { ...DEFAULT_PRESETS },
    transitionDurations: { ...DEFAULT_TRANSITION_DURATIONS },
    isTransitioning: false,
    transitionProgress: 0,
    transitionDuration: 0,
    startValues: structuredClone(DEFAULT_PRESETS['idle_disconnected']),
    targetValues: structuredClone(DEFAULT_PRESETS['idle_disconnected']),
    currentValues: structuredClone(DEFAULT_PRESETS['idle_disconnected']),
  },
  on: {
    SET_SITUATION: {
      actions: assign(({ context, event }) => {
        if (event.situation === context.situation) return {};
        const target = context.presets[event.situation];
        const duration = getTransitionDuration(
          context.transitionDurations,
          context.situation,
          event.situation,
        );
        return {
          previousSituation: context.situation,
          situation: event.situation,
          isTransitioning: true,
          transitionProgress: 0,
          transitionDuration: duration,
          startValues: structuredClone(context.currentValues),
          targetValues: mergePreset(context.currentValues, target),
        };
      }),
    },

    TICK: {
      actions: assign(({ context, event }) => {
        if (!context.isTransitioning || context.transitionDuration <= 0) return {};
        const newProgress = Math.min(
          context.transitionProgress + (event.delta * 1000) / context.transitionDuration,
          1,
        );
        const done = newProgress >= 1;
        return {
          transitionProgress: newProgress,
          isTransitioning: !done,
          currentValues: done
            ? structuredClone(context.targetValues)
            : interpolatePreset(context.startValues, context.targetValues, newProgress),
        };
      }),
    },

    UPDATE_PRESET: {
      actions: assign(({ context, event }) => ({
        presets: {
          ...context.presets,
          [event.situation]: mergePreset(context.presets[event.situation], event.preset),
        },
      })),
    },

    SAVE_CURRENT_AS_PRESET: {
      actions: assign(({ context, event }) => ({
        presets: {
          ...context.presets,
          [event.situation]: structuredClone(event.values),
        },
      })),
    },

    LOAD_PRESETS: {
      actions: assign(({ event }) => ({
        presets: event.presets,
        ...(event.durations ? { transitionDurations: event.durations } : {}),
      })),
    },

    RESTORE_DEFAULTS: {
      actions: assign({
        presets: { ...DEFAULT_PRESETS },
        transitionDurations: { ...DEFAULT_TRANSITION_DURATIONS },
      }),
    },
  },
});
