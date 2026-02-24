export type EasingType = 'linear' | 'smoothstep' | 'ease-in' | 'ease-out' | 'ease-in-out';

function linear(t: number): number { return t; }
function smoothstep(t: number): number { return t * t * (3 - 2 * t); }
function easeIn(t: number): number { return t * t; }
function easeOut(t: number): number { return t * (2 - t); }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

export const EASING_MAP: Record<EasingType, (t: number) => number> = {
  linear,
  smoothstep,
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
};

export const EASING_OPTIONS: EasingType[] = ['linear', 'smoothstep', 'ease-in', 'ease-out', 'ease-in-out'];

export function applyEasing(type: EasingType, t: number): number {
  return (EASING_MAP[type] ?? linear)(t);
}
