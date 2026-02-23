export interface LightPreset {
  position: { x: number; y: number; z: number };
  name: string;
  description: string;
}

export const LIGHT_POSITION_PRESETS: Record<string, LightPreset> = {
  'studio-classic': {
    position: { x: 1, y: 2, z: 3 },
    name: 'Studio Classique',
    description: 'Position studio standard'
  },
  'top-down': {
    position: { x: 0, y: 5, z: 0 },
    name: 'Plongee',
    description: 'Lumiere du haut (midi)'
  },
  'side-dramatic': {
    position: { x: 5, y: 1, z: 1 },
    name: 'Dramatique',
    description: 'Eclairage de cote'
  },
  'front-soft': {
    position: { x: 0, y: 1, z: 5 },
    name: 'Face douce',
    description: 'Lumiere frontale douce'
  },
  'back-rim': {
    position: { x: -2, y: 3, z: -2 },
    name: 'Contre-jour',
    description: 'Eclairage arriere'
  },
  'low-moody': {
    position: { x: 2, y: 0.5, z: 2 },
    name: 'Ambiance basse',
    description: 'Lumiere basse dramatique'
  }
} as const;

export type PresetKey = keyof typeof LIGHT_POSITION_PRESETS;
