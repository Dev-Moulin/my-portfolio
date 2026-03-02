export { neonDescriptor } from './neonDescriptor.ts';
export { textDescriptor } from './textDescriptor.ts';
export { lightDescriptor } from './lightDescriptor.ts';
export { cardDescriptor } from './cardDescriptor.ts';

export type { NeonExtra } from './neonDescriptor.ts';
export type { CardExtra } from './cardDescriptor.ts';

// ── Descriptor metadata for timeline UI ──────────────────────────────────────

export interface DescriptorMeta {
  readonly displayName: string;
  readonly trackColor: string;
}

export const DESCRIPTOR_META: Readonly<Record<string, DescriptorMeta>> = {
  neon: { displayName: 'Neon', trackColor: '#CE93D8' },
  text: { displayName: 'Text', trackColor: '#81C784' },
  light: { displayName: 'Light', trackColor: '#90A4AE' },
  card: { displayName: 'Card', trackColor: '#FFB74D' },
};

/** Mapping sourceId → descriptor type (sourceIds don't always match the type) */
const SOURCE_TO_TYPE: Record<string, string> = {
  neon: 'neon',
  title: 'text',
  subtitle: 'text',
  card: 'card',
  dirLight: 'light',
  pointLight: 'light',
};

/** Resolve descriptor metadata from an element instance ID (e.g. 'neon_1', 'title', 'card_2'). */
export function resolveDescriptorMeta(elementId: string): DescriptorMeta | null {
  // Direct match (e.g. 'neon', 'card', 'title')
  const directType = SOURCE_TO_TYPE[elementId];
  if (directType) return DESCRIPTOR_META[directType] ?? null;
  // Extract sourceId from pattern <sourceId>_<N> (e.g. 'neon_1' → 'neon')
  const idx = elementId.lastIndexOf('_');
  if (idx === -1) return null;
  const type = SOURCE_TO_TYPE[elementId.slice(0, idx)];
  return type ? (DESCRIPTOR_META[type] ?? null) : null;
}

// ── Default configs for creating new instances from the Library panel ─────────

import type { NeonInstanceConfig, TextInstanceConfig, LightInstanceConfig, CardInstanceConfig } from '../instanceRegistry.ts';
import { getFontPath } from '../../utils/dracoPath.ts';

export const DEFAULT_CONFIGS = {
  neon: (): NeonInstanceConfig => ({
    bands: [
      { color: '#ff69b4', intensity: 2.0, width: 0.6, visible: true },
      { color: '#e91e90', intensity: 2.0, width: 0.6, visible: true },
      { color: '#dc143c', intensity: 2.0, width: 0.6, visible: true },
    ],
    bandSpacing: 0.15, flowEnabled: true, flowSpeed: 1.0, globalIntensity: 1.0,
    positionX: 0, positionY: 1, positionZ: -3, scale: 0.5,
    arcRadius: 5, depthSpread: 1.0, lineLength: 6,
    cylinderMode: false, cylinderRadius: 5, cylinderCopies: 1,
    cylinderAutoFill: false, cylinderDirection: 'outward' as const,
  }),
  text: (basePath: string): TextInstanceConfig => ({
    text: 'New Text', font: getFontPath(basePath, 'Cynatar.otf'),
    fontSize: 0.6, color: '#ffffff', emissiveIntensity: 2.0,
    anchorX: 'center', anchorY: 'middle', textAlign: 'center',
  }),
  light: (): LightInstanceConfig => ({
    lightType: 'point', color: '#ffffff', intensity: 1.0,
    positionX: 0, positionY: 3, positionZ: 0, distance: 20,
  }),
  card: (): CardInstanceConfig => ({
    positionX: 0, positionY: 1, positionZ: 2, scale: 1,
  }),
};
