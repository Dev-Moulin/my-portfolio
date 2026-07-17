// ── Wheel input accumulator with decay, used by ScrollCameraAnimator ────────

export type GaugeState = 'dwell' | 'playing' | 'free' | 'reading' | 'attract';

export interface ScrollGaugeInputCallbacks {
  onForward: () => void;
  onBackward: () => void;
  onTextScroll: (deltaY: number) => void;
  getState: () => GaugeState;
  canFwd: () => boolean;
  canBack: () => boolean;
  isFreeLookNeutral: () => boolean; // false tant que le free-look (drag) n'est pas revenu à la vue neutre
  requestFreeLookReturn: () => void; // force le retour de la vue déviée (déclenché par un scroll)
}

const STEP_PER_WHEEL = 25;   // crans de molette pour déclencher un trajet = THRESHOLD/STEP (≈4, avant ≈10)
const DECAY_DELAY_MS = 300;
const DECAY_RATE = 200;
const THRESHOLD = 100;

export class ScrollGaugeInput {
  private callbacks: ScrollGaugeInputCallbacks;
  accumulator = 0;
  private lastInputTime = 0;
  private boundOnWheel: (e: WheelEvent) => void;

  constructor(callbacks: ScrollGaugeInputCallbacks) {
    this.callbacks = callbacks;
    this.boundOnWheel = this.onWheel.bind(this);
    window.addEventListener('wheel', this.boundOnWheel, { passive: false });
  }

  private onWheel(e: WheelEvent): void {
    const state = this.callbacks.getState();
    if (state === 'free') return; // let scroll pass through in free mode

    if (state === 'reading') {
      e.preventDefault();
      this.callbacks.onTextScroll(e.deltaY);
      return;
    }

    if (state === 'playing') {
      e.preventDefault();
      return;
    }

    // dwell
    e.preventDefault();
    // Bloque la navigation tant que le free-look (drag) n'est pas revenu à la vue neutre : évite
    // d'avancer « de travers » alors que l'utilisateur regarde encore ailleurs.
    if (!this.callbacks.isFreeLookNeutral()) { this.callbacks.requestFreeLookReturn(); return; }
    const sign = Math.sign(e.deltaY);
    const canFwd = this.callbacks.canFwd();
    const canBack = this.callbacks.canBack();

    // Block direction if at edge
    if (sign > 0 && !canFwd) { this.accumulator = Math.min(this.accumulator, 0); return; }
    if (sign < 0 && !canBack) { this.accumulator = Math.max(this.accumulator, 0); return; }

    this.accumulator += sign * STEP_PER_WHEEL;
    this.accumulator = Math.max(-THRESHOLD, Math.min(THRESHOLD, this.accumulator));
    this.lastInputTime = performance.now();

    // Trigger thresholds
    if (this.accumulator >= THRESHOLD && canFwd) {
      this.accumulator = 0;
      this.callbacks.onForward();
    } else if (this.accumulator <= -THRESHOLD && canBack) {
      this.accumulator = 0;
      this.callbacks.onBackward();
    }
  }

  update(delta: number): void {
    const now = performance.now();
    if (now - this.lastInputTime > DECAY_DELAY_MS && this.accumulator !== 0) {
      const decay = DECAY_RATE * delta;
      if (Math.abs(this.accumulator) <= decay) {
        this.accumulator = 0;
      } else {
        this.accumulator -= Math.sign(this.accumulator) * decay;
      }
    }
  }

  /** Normalized -1..+1 for UI */
  getValue(): number {
    return this.accumulator / THRESHOLD;
  }

  reset(): void {
    this.accumulator = 0;
  }

  dispose(): void {
    window.removeEventListener('wheel', this.boundOnWheel);
  }
}
