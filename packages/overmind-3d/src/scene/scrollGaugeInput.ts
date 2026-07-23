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
// ── Tactile ── Convention Paul : swipe vers le HAUT = avancer (même signe que molette bas).
const TOUCH_PX_TO_UNIT = 0.6;  // px de doigt → unités d'accumulateur : ~170 px de swipe = 1 cran
const TOUCH_READ_FACTOR = 1.5; // px de doigt → delta lecture de carte (le wheel envoie ~100/cran)

export class ScrollGaugeInput {
  private callbacks: ScrollGaugeInputCallbacks;
  accumulator = 0;
  private lastInputTime = 0;
  private lastTouchY: number | null = null;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: () => void;

  constructor(callbacks: ScrollGaugeInputCallbacks) {
    this.callbacks = callbacks;
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = () => { this.lastTouchY = null; };
    window.addEventListener('wheel', this.boundOnWheel, { passive: false });
    // Même canal que la molette : le tactile FEED la même jauge (routing par état partagé).
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.boundTouchEnd, { passive: true });
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
    this.feedNav(Math.sign(e.deltaY) * STEP_PER_WHEEL);
  }

  private onTouchStart(e: TouchEvent): void {
    // 1 seul doigt = geste de nav ; 2+ doigts (pinch, bloqué par ailleurs) = on ignore.
    this.lastTouchY = e.touches.length === 1 ? e.touches[0].clientY : null;
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length !== 1 || this.lastTouchY === null) return;
    const y = e.touches[0].clientY;
    const dy = this.lastTouchY - y; // doigt vers le haut → dy > 0 → avancer (comme molette bas)
    this.lastTouchY = y;

    const state = this.callbacks.getState();
    if (state === 'free') return;

    if (state === 'reading') {
      e.preventDefault();
      this.callbacks.onTextScroll(dy * TOUCH_READ_FACTOR);
      return;
    }

    if (state === 'playing') {
      e.preventDefault();
      return;
    }

    // dwell
    e.preventDefault();
    this.feedNav(dy * TOUCH_PX_TO_UNIT);
  }

  /** Cœur commun molette/tactile en dwell : garde-fou free-look, bornes, seuil de déclenchement. */
  private feedNav(amount: number): void {
    if (amount === 0) return;
    // Bloque la navigation tant que le free-look (drag) n'est pas revenu à la vue neutre : évite
    // d'avancer « de travers » alors que l'utilisateur regarde encore ailleurs.
    if (!this.callbacks.isFreeLookNeutral()) { this.callbacks.requestFreeLookReturn(); return; }
    const sign = Math.sign(amount);
    const canFwd = this.callbacks.canFwd();
    const canBack = this.callbacks.canBack();

    // Block direction if at edge
    if (sign > 0 && !canFwd) { this.accumulator = Math.min(this.accumulator, 0); return; }
    if (sign < 0 && !canBack) { this.accumulator = Math.max(this.accumulator, 0); return; }

    this.accumulator += amount;
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
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('touchcancel', this.boundTouchEnd);
  }
}
