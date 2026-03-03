export type EasingType =
  | 'linear' | 'smoothstep'
  | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic'
  | 'back-in' | 'back-out' | 'back-in-out'
  | 'bounce' | 'elastic'
  | 'step';

// ── Basic ────────────────────────────────────────────────────────────────────

function linear(t: number): number { return t; }
function smoothstep(t: number): number { return t * t * (3 - 2 * t); }
function easeIn(t: number): number { return t * t; }
function easeOut(t: number): number { return t * (2 - t); }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ── Cubic ────────────────────────────────────────────────────────────────────

function easeInCubic(t: number): number { return t * t * t; }
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Back (overshoot) ─────────────────────────────────────────────────────────

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;

function backIn(t: number): number { return c3 * t * t * t - c1 * t * t; }
function backOut(t: number): number { return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function backInOut(t: number): number {
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

// ── Bounce ───────────────────────────────────────────────────────────────────

function bounce(t: number): number {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// ── Elastic ──────────────────────────────────────────────────────────────────

function elastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}

// ── Step (constant) ──────────────────────────────────────────────────────────

function step(t: number): number { return t < 1 ? 0 : 1; }

// ── Map & Options ────────────────────────────────────────────────────────────

export const EASING_MAP: Record<EasingType, (t: number) => number> = {
  linear,
  smoothstep,
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
  'ease-in-cubic': easeInCubic,
  'ease-out-cubic': easeOutCubic,
  'ease-in-out-cubic': easeInOutCubic,
  'back-in': backIn,
  'back-out': backOut,
  'back-in-out': backInOut,
  bounce,
  elastic,
  step,
};

export const EASING_OPTIONS: EasingType[] = [
  'linear', 'smoothstep',
  'ease-in', 'ease-out', 'ease-in-out',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic',
  'back-in', 'back-out', 'back-in-out',
  'bounce', 'elastic',
  'step',
];

export const EASING_LABELS: Record<EasingType, string> = {
  'linear': 'Linear',
  'smoothstep': 'Smoothstep',
  'ease-in': 'Ease In',
  'ease-out': 'Ease Out',
  'ease-in-out': 'Ease In-Out',
  'ease-in-cubic': 'Cubic In',
  'ease-out-cubic': 'Cubic Out',
  'ease-in-out-cubic': 'Cubic In-Out',
  'back-in': 'Back In',
  'back-out': 'Back Out',
  'back-in-out': 'Back In-Out',
  'bounce': 'Bounce',
  'elastic': 'Elastic',
  'step': 'Step (Constant)',
};

export function applyEasing(type: EasingType, t: number): number {
  return (EASING_MAP[type] ?? linear)(t);
}

// Re-export named functions for direct use
export { easeInOutCubic };
