export interface PBRPreset {
  metalness: number;
  roughness: number;
  name: string;
  description: string;
}

export const PBR_PRESETS: Record<string, PBRPreset> = {
  'chrome': {
    metalness: 1.0,
    roughness: 0.1,
    name: 'Chrome',
    description: 'Metal poli brillant'
  },
  'glass': {
    metalness: 0.0,
    roughness: 0.0,
    name: 'Glass',
    description: 'Verre transparent'
  },
  'matte': {
    metalness: 0.0,
    roughness: 1.0,
    name: 'Matte',
    description: 'Surface mate non reflechissante'
  },
  'plastic': {
    metalness: 0.0,
    roughness: 0.4,
    name: 'Plastic',
    description: 'Plastique semi-brillant'
  }
} as const;

export type PBRPresetKey = keyof typeof PBR_PRESETS;
