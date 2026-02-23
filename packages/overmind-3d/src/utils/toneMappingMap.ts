import * as THREE from 'three';

export type ToneMappingType =
  | 'NoToneMapping'
  | 'LinearToneMapping'
  | 'ReinhardToneMapping'
  | 'CineonToneMapping'
  | 'ACESFilmicToneMapping';

export const TONE_MAPPING_MAP: Record<ToneMappingType, THREE.ToneMapping> = {
  'NoToneMapping': THREE.NoToneMapping,
  'LinearToneMapping': THREE.LinearToneMapping,
  'ReinhardToneMapping': THREE.ReinhardToneMapping,
  'CineonToneMapping': THREE.CineonToneMapping,
  'ACESFilmicToneMapping': THREE.ACESFilmicToneMapping
};

export const TONE_MAPPING_OPTIONS: { value: ToneMappingType; label: string }[] = [
  { value: 'NoToneMapping', label: 'None' },
  { value: 'LinearToneMapping', label: 'Linear' },
  { value: 'ReinhardToneMapping', label: 'Reinhard' },
  { value: 'CineonToneMapping', label: 'Cineon' },
  { value: 'ACESFilmicToneMapping', label: 'ACES Filmic' }
];
