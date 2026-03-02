import { setup, assign } from 'xstate';

export interface BandConfig {
  color: string;
  intensity: number;
  width: number;
  visible: boolean;
}

export interface NeonBandsContext {
  bands: BandConfig[];
  flowSpeed: number;
  flowEnabled: boolean;
  globalIntensity: number;
  bandSpacing: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
  arcRadius: number;
  depthSpread: number;   // multiplier: how much bands widen along depth (1 = no spread, 4 = 4x wider at end)
  lineLength: number;    // total vertical length of the bands (Y_TOP value)
  cylinderMode: boolean;
  cylinderRadius: number;
  cylinderCopies: number;
  cylinderAutoFill: boolean;
  cylinderDirection: 'outward' | 'inward';
}

export type NeonBandsEvents =
  | { type: 'UPDATE_BAND_COLOR'; index: number; color: string }
  | { type: 'UPDATE_BAND_INTENSITY'; index: number; intensity: number }
  | { type: 'UPDATE_BAND_WIDTH'; index: number; width: number }
  | { type: 'TOGGLE_BAND_VISIBLE'; index: number }
  | { type: 'UPDATE_FLOW_SPEED'; speed: number }
  | { type: 'TOGGLE_FLOW' }
  | { type: 'UPDATE_GLOBAL_INTENSITY'; intensity: number }
  | { type: 'UPDATE_BAND_SPACING'; spacing: number }
  | { type: 'UPDATE_POSITION_X'; x: number }
  | { type: 'UPDATE_POSITION_Y'; y: number }
  | { type: 'UPDATE_POSITION_Z'; z: number }
  | { type: 'UPDATE_SCALE'; scale: number }
  | { type: 'UPDATE_ARC_RADIUS'; radius: number }
  | { type: 'UPDATE_DEPTH_SPREAD'; spread: number }
  | { type: 'UPDATE_LINE_LENGTH'; length: number }
  | { type: 'APPLY_PRESET'; presetName: string }
  | { type: 'SET_ALL_WIDTHS'; width: number }
  | { type: 'TOGGLE_CYLINDER_MODE' }
  | { type: 'UPDATE_CYLINDER_RADIUS'; radius: number }
  | { type: 'UPDATE_CYLINDER_COPIES'; copies: number }
  | { type: 'TOGGLE_CYLINDER_AUTO_FILL' }
  | { type: 'UPDATE_CYLINDER_DIRECTION'; direction: 'outward' | 'inward' }
  | { type: 'RESTORE_DEFAULTS' }
  | { type: 'RESTORE_CONTEXT'; context: NeonBandsContext };

// ─── Color Presets ────────────────────────────────────────────────────────────

export interface NeonPreset {
  name: string;
  bands: BandConfig[];
}

const PRESET_SUNSET: BandConfig[] = [
  { color: '#ff69b4', intensity: 2.0, width: 0.6, visible: true },  // Hot Pink
  { color: '#e91e90', intensity: 2.0, width: 0.6, visible: true },  // Magenta
  { color: '#dc143c', intensity: 2.0, width: 0.6, visible: true },  // Crimson
  { color: '#ff4500', intensity: 2.2, width: 0.6, visible: true },  // Red-Orange
  { color: '#ff8c00', intensity: 2.0, width: 0.6, visible: true },  // Orange
  { color: '#f5e6c8', intensity: 1.8, width: 0.6, visible: true },  // Cream
  { color: '#1a237e', intensity: 2.5, width: 0.6, visible: true },  // Navy
  { color: '#1565c0', intensity: 2.0, width: 0.6, visible: true },  // Blue
  { color: '#2196f3', intensity: 2.0, width: 0.6, visible: true },  // Sky Blue
  { color: '#00bcd4', intensity: 2.0, width: 0.6, visible: true },  // Cyan
];

const PRESET_GOLDEN_HOUR: BandConfig[] = [
  { color: '#ff6b35', intensity: 2.2, width: 0.6, visible: true },  // Burnt Orange
  { color: '#f7931e', intensity: 2.0, width: 0.6, visible: true },  // Tangerine
  { color: '#fbb040', intensity: 2.0, width: 0.6, visible: true },  // Marigold
  { color: '#ffd700', intensity: 1.8, width: 0.6, visible: true },  // Gold
  { color: '#ffe066', intensity: 1.5, width: 0.6, visible: true },  // Light Gold
  { color: '#fff4cc', intensity: 1.2, width: 0.6, visible: true },  // Champagne
  { color: '#ff8566', intensity: 2.0, width: 0.6, visible: true },  // Salmon
  { color: '#ff5e62', intensity: 2.2, width: 0.6, visible: true },  // Coral
  { color: '#c94b4b', intensity: 2.5, width: 0.6, visible: true },  // Terracotta
  { color: '#8b2252', intensity: 2.3, width: 0.6, visible: true },  // Wine
];

const PRESET_SYNTHWAVE: BandConfig[] = [
  { color: '#ff2975', intensity: 2.5, width: 0.6, visible: true },  // Neon Pink
  { color: '#f222ff', intensity: 2.3, width: 0.6, visible: true },  // Electric Purple
  { color: '#8b00ff', intensity: 2.0, width: 0.6, visible: true },  // Violet
  { color: '#6600cc', intensity: 2.2, width: 0.6, visible: true },  // Deep Purple
  { color: '#3300ff', intensity: 2.0, width: 0.6, visible: true },  // Indigo
  { color: '#0066ff', intensity: 2.2, width: 0.6, visible: true },  // Electric Blue
  { color: '#00ccff', intensity: 2.5, width: 0.6, visible: true },  // Cyan
  { color: '#ff6ec7', intensity: 2.0, width: 0.6, visible: true },  // Rose Pink
  { color: '#ff1493', intensity: 2.3, width: 0.6, visible: true },  // Deep Pink
  { color: '#cc00ff', intensity: 2.0, width: 0.6, visible: true },  // Magenta
];

const PRESET_INFERNO: BandConfig[] = [
  { color: '#ff0000', intensity: 2.5, width: 0.6, visible: true },  // Red
  { color: '#ff2200', intensity: 2.3, width: 0.6, visible: true },  // Red-Orange
  { color: '#ff4400', intensity: 2.2, width: 0.6, visible: true },  // Orange-Red
  { color: '#ff6600', intensity: 2.0, width: 0.6, visible: true },  // Orange
  { color: '#ff8800', intensity: 2.0, width: 0.6, visible: true },  // Dark Orange
  { color: '#ffaa00', intensity: 2.2, width: 0.6, visible: true },  // Amber
  { color: '#ffcc00', intensity: 2.0, width: 0.6, visible: true },  // Gold
  { color: '#ffee00', intensity: 1.8, width: 0.6, visible: true },  // Yellow
  { color: '#ffffff', intensity: 1.5, width: 0.6, visible: true },  // White core
  { color: '#ff3300', intensity: 2.5, width: 0.6, visible: true },  // Scarlet
];

const PRESET_FOREST: BandConfig[] = [
  { color: '#004d00', intensity: 2.5, width: 0.6, visible: true },  // Dark Forest
  { color: '#006600', intensity: 2.3, width: 0.6, visible: true },  // Pine
  { color: '#228b22', intensity: 2.0, width: 0.6, visible: true },  // Forest Green
  { color: '#32cd32', intensity: 2.0, width: 0.6, visible: true },  // Lime Green
  { color: '#66ff66', intensity: 1.8, width: 0.6, visible: true },  // Light Green
  { color: '#ccff99', intensity: 1.5, width: 0.6, visible: true },  // Pale Lime
  { color: '#8fbc8f', intensity: 1.8, width: 0.6, visible: true },  // Dark Sea Green
  { color: '#2e8b57', intensity: 2.2, width: 0.6, visible: true },  // Sea Green
  { color: '#006400', intensity: 2.5, width: 0.6, visible: true },  // Deep Green
  { color: '#00ff7f', intensity: 2.0, width: 0.6, visible: true },  // Spring Green
];

const PRESET_MIDNIGHT: BandConfig[] = [
  { color: '#0a0020', intensity: 2.8, width: 0.6, visible: true },  // Deep Night
  { color: '#1a0044', intensity: 2.5, width: 0.6, visible: true },  // Dark Purple
  { color: '#2a1065', intensity: 2.2, width: 0.6, visible: true },  // Plum
  { color: '#3d1a8e', intensity: 2.0, width: 0.6, visible: true },  // Royal Purple
  { color: '#0d47a1', intensity: 2.3, width: 0.6, visible: true },  // Dark Blue
  { color: '#1565c0', intensity: 2.0, width: 0.6, visible: true },  // Blue
  { color: '#1e88e5', intensity: 1.8, width: 0.6, visible: true },  // Medium Blue
  { color: '#283593', intensity: 2.5, width: 0.6, visible: true },  // Indigo
  { color: '#4527a0', intensity: 2.2, width: 0.6, visible: true },  // Deep Violet
  { color: '#6a1b9a', intensity: 2.0, width: 0.6, visible: true },  // Purple
];

export const NEON_PRESETS: Record<string, BandConfig[]> = {
  Sunset: PRESET_SUNSET,
  Inferno: PRESET_INFERNO,
  'Golden Hour': PRESET_GOLDEN_HOUR,
  Synthwave: PRESET_SYNTHWAVE,
  Forest: PRESET_FOREST,
  Midnight: PRESET_MIDNIGHT,
};

export const NEON_PRESET_NAMES = Object.keys(NEON_PRESETS);

const DEFAULT_BANDS = PRESET_SUNSET;

export const neonBandsMachine = setup({
  types: {} as {
    context: NeonBandsContext;
    events: NeonBandsEvents;
  },
}).createMachine({
  id: 'neonBands',
  context: {
    bands: DEFAULT_BANDS.map(b => ({ ...b })),
    flowSpeed: 1.0,
    flowEnabled: true,
    globalIntensity: 1.0,
    bandSpacing: 0.15,
    positionX: 0,
    positionY: 0,
    positionZ: -5,
    scale: 1.0,
    arcRadius: 5,
    depthSpread: 1.0,
    lineLength: 12,
    cylinderMode: false,
    cylinderRadius: 5,
    cylinderCopies: 1,
    cylinderAutoFill: false,
    cylinderDirection: 'outward' as const,
  },
  on: {
    UPDATE_BAND_COLOR: {
      actions: assign({
        bands: ({ context, event }) => context.bands.map((b, i) =>
          i === event.index ? { ...b, color: event.color } : b
        ),
      }),
    },
    UPDATE_BAND_INTENSITY: {
      actions: assign({
        bands: ({ context, event }) => context.bands.map((b, i) =>
          i === event.index ? { ...b, intensity: event.intensity } : b
        ),
      }),
    },
    UPDATE_BAND_WIDTH: {
      actions: assign({
        bands: ({ context, event }) => context.bands.map((b, i) =>
          i === event.index ? { ...b, width: event.width } : b
        ),
      }),
    },
    TOGGLE_BAND_VISIBLE: {
      actions: assign({
        bands: ({ context, event }) => context.bands.map((b, i) =>
          i === event.index ? { ...b, visible: !b.visible } : b
        ),
      }),
    },
    UPDATE_FLOW_SPEED: {
      actions: assign({ flowSpeed: ({ event }) => event.speed }),
    },
    TOGGLE_FLOW: {
      actions: assign({ flowEnabled: ({ context }) => !context.flowEnabled }),
    },
    UPDATE_GLOBAL_INTENSITY: {
      actions: assign({ globalIntensity: ({ event }) => event.intensity }),
    },
    UPDATE_BAND_SPACING: {
      actions: assign({ bandSpacing: ({ event }) => event.spacing }),
    },
    UPDATE_POSITION_X: {
      actions: assign({ positionX: ({ event }) => event.x }),
    },
    UPDATE_POSITION_Y: {
      actions: assign({ positionY: ({ event }) => event.y }),
    },
    UPDATE_POSITION_Z: {
      actions: assign({ positionZ: ({ event }) => event.z }),
    },
    UPDATE_SCALE: {
      actions: assign({ scale: ({ event }) => event.scale }),
    },
    UPDATE_ARC_RADIUS: {
      actions: assign({ arcRadius: ({ event }) => event.radius }),
    },
    UPDATE_DEPTH_SPREAD: {
      actions: assign({ depthSpread: ({ event }) => event.spread }),
    },
    UPDATE_LINE_LENGTH: {
      actions: assign({ lineLength: ({ event }) => event.length }),
    },
    APPLY_PRESET: {
      actions: assign({
        bands: ({ event }) => {
          const preset = NEON_PRESETS[event.presetName];
          return preset ? preset.map(b => ({ ...b })) : DEFAULT_BANDS.map(b => ({ ...b }));
        },
      }),
    },
    SET_ALL_WIDTHS: {
      actions: assign({
        bands: ({ context, event }) => context.bands.map(b => ({ ...b, width: event.width })),
      }),
    },
    TOGGLE_CYLINDER_MODE: {
      actions: assign({ cylinderMode: ({ context }) => !context.cylinderMode }),
    },
    UPDATE_CYLINDER_RADIUS: {
      actions: assign({ cylinderRadius: ({ event }) => event.radius }),
    },
    UPDATE_CYLINDER_COPIES: {
      actions: assign({ cylinderCopies: ({ event }) => event.copies }),
    },
    TOGGLE_CYLINDER_AUTO_FILL: {
      actions: assign({ cylinderAutoFill: ({ context }) => !context.cylinderAutoFill }),
    },
    UPDATE_CYLINDER_DIRECTION: {
      actions: assign({ cylinderDirection: ({ event }) => event.direction }),
    },
    RESTORE_CONTEXT: {
      actions: assign(({ event }) => event.context),
    },
    RESTORE_DEFAULTS: {
      actions: assign({
        bands: () => DEFAULT_BANDS.map(b => ({ ...b })),
        flowSpeed: 1.0,
        flowEnabled: true,
        globalIntensity: 1.0,
        bandSpacing: 0.15,
        positionX: 0,
        positionY: 0,
        positionZ: -5,
        scale: 1.0,
        arcRadius: 5,
        depthSpread: 1.0,
        lineLength: 12,
        cylinderMode: false,
        cylinderRadius: 5,
        cylinderCopies: 1,
        cylinderAutoFill: false,
        cylinderDirection: 'outward' as const,
      }),
    },
  },
});
