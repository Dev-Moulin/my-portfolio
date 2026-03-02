/**
 * Neon color themes + band generator for the Library configurator.
 * Interpolates between reference colors in HSL space to produce N bands.
 */

import type { BandConfig } from '../machines/neonBandsMachine.ts';
import { hslToHex, lerpColor } from './colorInterpolation.ts';

// ─── Theme definitions ───────────────────────────────────────────────────────

export interface NeonTheme {
  label: string;
  colors: string[];                  // 2-4 hex reference colors
  intensityRange: [number, number];  // [min, max] intensity spread
}

export const NEON_THEMES: NeonTheme[] = [
  { label: 'Sunset',      colors: ['#ff69b4', '#ff4500', '#1a237e', '#00bcd4'], intensityRange: [1.8, 2.5] },
  { label: 'Golden Hour', colors: ['#ff6b35', '#ffd700', '#ff5e62', '#8b2252'], intensityRange: [1.5, 2.5] },
  { label: 'Synthwave',   colors: ['#ff2975', '#8b00ff', '#0066ff', '#00ccff'], intensityRange: [2.0, 2.5] },
  { label: 'Inferno',     colors: ['#ff0000', '#ff8800', '#ffee00', '#ffffff'], intensityRange: [1.5, 2.5] },
  { label: 'Forest',      colors: ['#004d00', '#32cd32', '#ccff99', '#00ff7f'], intensityRange: [1.5, 2.5] },
  { label: 'Midnight',    colors: ['#0a0020', '#3d1a8e', '#1565c0', '#6a1b9a'], intensityRange: [1.8, 2.8] },
  { label: 'Rainbow',     colors: [],                                           intensityRange: [1.8, 2.2] },
];

export const NEON_THEME_LABELS = NEON_THEMES.map(t => t.label);

// ─── Band generator ──────────────────────────────────────────────────────────

/**
 * Generate N BandConfig entries for a given theme.
 * - Rainbow: uniform hue distribution 0→360
 * - Others: HSL interpolation along reference color segments
 */
export function generateBandColors(count: number, themeLabel: string): BandConfig[] {
  const theme = NEON_THEMES.find(t => t.label === themeLabel) ?? NEON_THEMES[0];
  const [minI, maxI] = theme.intensityRange;
  const bands: BandConfig[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const intensity = minI + (maxI - minI) * t;

    let color: string;
    if (themeLabel === 'Rainbow' || theme.colors.length === 0) {
      // Uniform hue distribution
      color = hslToHex(i / count, 1, 0.5);
    } else {
      color = sampleGradient(theme.colors, t);
    }

    bands.push({ color, intensity: Math.round(intensity * 10) / 10, width: 0.6, visible: true });
  }

  return bands;
}

/** Sample a multi-stop gradient at position t ∈ [0, 1] */
function sampleGradient(colors: string[], t: number): string {
  if (colors.length === 1) return colors[0];
  const segments = colors.length - 1;
  const raw = t * segments;
  const idx = Math.min(Math.floor(raw), segments - 1);
  const local = raw - idx;
  return lerpColor(colors[idx], colors[idx + 1], local);
}
