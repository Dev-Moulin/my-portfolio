/**
 * Visual Presets — Types and default values.
 * Presets define the visual appearance of the Overmind eye per situation.
 * Values exported from the DevControlPanel.
 */

export type Situation =
  | 'idle_disconnected'
  | 'idle_connected'
  | 'error'
  | 'alphabet_search'
  | 'buy_success'
  | 'afk';

export const SITUATIONS: Situation[] = [
  'idle_disconnected',
  'idle_connected',
  'error',
  'alphabet_search',
  'buy_success',
  'afk',
];

export interface VisualPreset {
  bloom?: {
    color?: string;
    strength?: number;
    threshold?: number;
    radius?: number;
  };
  lighting?: {
    ambientIntensity?: number;
    directionalIntensity?: number;
    pointIntensity?: number;
    exposure?: number;
    hdrBoostMultiplier?: number;
  };
  material?: {
    iris?: { emissiveColor?: string; emissiveIntensity?: number };
    eyeRings?: { emissiveColor?: string; emissiveIntensity?: number };
    revealRings?: { emissiveColor?: string; emissiveIntensity?: number };
  };
  pbr?: {
    eyeRings?: { metalness?: number; roughness?: number };
    iris?: { metalness?: number; roughness?: number };
    magicRings?: { metalness?: number; roughness?: number };
    arms?: { metalness?: number; roughness?: number };
  };
}

const PBR_DEFAULT = {
  eyeRings: { metalness: 0.5, roughness: 0.5 },
  iris: { metalness: 0.5, roughness: 0.5 },
  magicRings: { metalness: 0.5, roughness: 0.5 },
  arms: { metalness: 0.5, roughness: 0.5 },
};

const LIGHTING_DEFAULT = {
  ambientIntensity: 0.5,
  directionalIntensity: 2,
  pointIntensity: 2,
  exposure: 1,
  hdrBoostMultiplier: 2,
};

/** Default presets — values exported from the DevControlPanel */
export const DEFAULT_PRESETS: Record<Situation, VisualPreset> = {
  idle_disconnected: {
    bloom: { color: '#00d0fa', strength: 1, threshold: 0.5, radius: 0.07 },
    lighting: LIGHTING_DEFAULT,
    material: {
      iris: { emissiveColor: '#00d0fa', emissiveIntensity: 1.2 },
      eyeRings: { emissiveColor: '#00d0fa', emissiveIntensity: 2 },
      revealRings: { emissiveColor: '#00d0fa', emissiveIntensity: 2 },
    },
    pbr: PBR_DEFAULT,
  },
  idle_connected: {
    bloom: { color: '#00bfff', strength: 1, threshold: 0.5, radius: 0.07 },
    lighting: LIGHTING_DEFAULT,
    material: {
      iris: { emissiveColor: '#00bfff', emissiveIntensity: 1.2 },
      eyeRings: { emissiveColor: '#00bfff', emissiveIntensity: 2 },
      revealRings: { emissiveColor: '#00bfff', emissiveIntensity: 2 },
    },
    pbr: PBR_DEFAULT,
  },
  error: {
    bloom: { color: '#fa0000', strength: 1, threshold: 0.45, radius: 0.08 },
    lighting: LIGHTING_DEFAULT,
    material: {
      iris: { emissiveColor: '#fa0000', emissiveIntensity: 2 },
      eyeRings: { emissiveColor: '#fa0000', emissiveIntensity: 2 },
      revealRings: { emissiveColor: '#fa0000', emissiveIntensity: 2 },
    },
    pbr: PBR_DEFAULT,
  },
  alphabet_search: {
    bloom: { color: '#fae500', strength: 1, threshold: 0.53, radius: 0.3 },
    lighting: LIGHTING_DEFAULT,
    material: {
      iris: { emissiveColor: '#fae500', emissiveIntensity: 1.2 },
      eyeRings: { emissiveColor: '#fae500', emissiveIntensity: 2 },
      revealRings: { emissiveColor: '#fae500', emissiveIntensity: 2 },
    },
    pbr: PBR_DEFAULT,
  },
  buy_success: {
    bloom: { color: '#00fa3e', strength: 1, threshold: 0.53, radius: 0.5 },
    lighting: LIGHTING_DEFAULT,
    material: {
      iris: { emissiveColor: '#00fa3e', emissiveIntensity: 1.2 },
      eyeRings: { emissiveColor: '#00fa3e', emissiveIntensity: 2 },
      revealRings: { emissiveColor: '#00fa3e', emissiveIntensity: 2 },
    },
    pbr: PBR_DEFAULT,
  },
  afk: {
    bloom: { color: '#ffffff', strength: 1, threshold: 0.53, radius: 0.43 },
    lighting: LIGHTING_DEFAULT,
    material: {
      iris: { emissiveColor: '#ffffff', emissiveIntensity: 0.9 },
      eyeRings: { emissiveColor: '#ffffff', emissiveIntensity: 1.5 },
      revealRings: { emissiveColor: '#ffffff', emissiveIntensity: 2 },
    },
    pbr: PBR_DEFAULT,
  },
};

/** Transition durations in ms. Key format: "from->to" or "*->to" / "from->*" for wildcards */
export const DEFAULT_TRANSITION_DURATIONS: Record<string, number> = {
  'idle_disconnected->idle_connected': 1000,
  'idle_connected->idle_disconnected': 1000,
  '*->error': 300,
  'error->*': 800,
  '*->alphabet_search': 500,
  'alphabet_search->*': 500,
  '*->buy_success': 500,
  'buy_success->*': 1000,
  '*->afk': 3000,
  'afk->*': 800,
};

/** Look up transition duration with wildcard fallback */
export function getTransitionDuration(
  durations: Record<string, number>,
  from: Situation,
  to: Situation,
): number {
  return durations[`${from}->${to}`]
    ?? durations[`*->${to}`]
    ?? durations[`${from}->*`]
    ?? 800;
}
