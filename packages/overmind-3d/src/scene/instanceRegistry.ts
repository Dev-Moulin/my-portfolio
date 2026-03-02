import type { BandConfig } from '../machines/neonBandsMachine.ts';

// --- Config types (consumed by descriptors, hooks, and UI panels) ---

export type InstanceType = 'neon' | 'text' | 'light' | 'card';

export interface NeonInstanceConfig {
  bands: BandConfig[];
  bandSpacing: number;
  flowEnabled: boolean;
  flowSpeed: number;
  globalIntensity: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
  arcRadius: number;
  depthSpread: number;
  lineLength: number;
  cylinderMode: boolean;
  cylinderRadius: number;
  cylinderCopies: number;
  cylinderAutoFill: boolean;
  cylinderDirection: 'outward' | 'inward';
}

export interface TextInstanceConfig {
  text: string;
  font: string;
  fontSize: number;
  color: string;
  emissiveIntensity: number;
  anchorX: string;
  anchorY: string;
  textAlign: string;
  maxWidth?: number;
}

export interface LightInstanceConfig {
  lightType: 'directional' | 'point';
  color: string;
  intensity: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  distance?: number;
}

export interface CardInstanceConfig {
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
}
