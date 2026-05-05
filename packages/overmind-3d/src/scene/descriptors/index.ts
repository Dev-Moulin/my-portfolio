export { textDescriptor } from './textDescriptor.ts';
export { lightDescriptor } from './lightDescriptor.ts';
export { cardDescriptor } from './cardDescriptor.ts';

export type { CardExtra } from './cardDescriptor.ts';
export type { LightExtra } from './lightDescriptor.ts';

// ── Descriptor metadata for timeline UI ──────────────────────────────────────

export interface DescriptorMeta {
  readonly displayName: string;
  readonly trackColor: string;
}

export const DESCRIPTOR_META: Readonly<Record<string, DescriptorMeta>> = {
  text: { displayName: 'Text', trackColor: '#81C784' },
  light: { displayName: 'Light', trackColor: '#90A4AE' },
  card: { displayName: 'Card', trackColor: '#FFB74D' },
};

/** Mapping sourceId → descriptor type (sourceIds don't always match the type) */
const SOURCE_TO_TYPE: Record<string, string> = {
  title: 'text',
  subtitle: 'text',
  card: 'card',
  dirLight: 'light',
  pointLight: 'light',
  spotLight: 'light',
  areaLight: 'light',
  light: 'light',
};

/** Resolve descriptor metadata from an element instance ID (e.g. 'title', 'card_2'). */
export function resolveDescriptorMeta(elementId: string): DescriptorMeta | null {
  // Direct match (e.g. 'card', 'title')
  const directType = SOURCE_TO_TYPE[elementId];
  if (directType) return DESCRIPTOR_META[directType] ?? null;
  // Extract sourceId from pattern <sourceId>_<N> (e.g. 'card_1' → 'card')
  const idx = elementId.lastIndexOf('_');
  if (idx === -1) return null;
  const type = SOURCE_TO_TYPE[elementId.slice(0, idx)];
  return type ? (DESCRIPTOR_META[type] ?? null) : null;
}

// ── Default configs for creating new instances from the Library panel ─────────

import type { TextInstanceConfig, LightInstanceConfig, CardInstanceConfig } from '../instanceRegistry.ts';
import { getFontPath } from '../../utils/dracoPath.ts';

export const DEFAULT_CONFIGS = {
  text: (basePath: string): TextInstanceConfig => ({
    text: 'New Text', font: getFontPath(basePath, 'Cynatar.otf'),
    fontSize: 0.6, color: '#ffffff', emissiveIntensity: 2.0,
    anchorX: 'center', anchorY: 'middle', textAlign: 'center',
  }),
  light: (): LightInstanceConfig => ({
    lightType: 'point', color: '#ffffff', intensity: 1.0,
    positionX: 0, positionY: 3, positionZ: 0, distance: 0, decay: 2,
  }),
  card: (): CardInstanceConfig => ({
    positionX: 0, positionY: 1, positionZ: 2, scale: 1,
  }),
};
