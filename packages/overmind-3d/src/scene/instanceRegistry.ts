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
  lightType: 'directional' | 'point' | 'spot' | 'area';
  color: string;
  intensity: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  // Point + Spot
  distance?: number;
  decay?: number;
  // Spot
  angle?: number;
  penumbra?: number;
  // Spot + Directional: target
  targetX?: number;
  targetY?: number;
  targetZ?: number;
  // Area (RectAreaLight)
  areaWidth?: number;
  areaHeight?: number;
  // Rotation (radians) — used for spot/directional target sync
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  // Volumetric cone (spot only)
  volumetric?: boolean;
  // Track To constraint
  trackToTargetId?: string;          // instance ID of the target ('' = disabled)
  trackToMaintainDistance?: boolean;  // keep initial distance from target (default true)
  trackToFollowPosition?: boolean;   // also follow target position (default false)
}

export interface CardInstanceConfig {
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
}
