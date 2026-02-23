import { MathUtils } from 'three';
import type * as YUKA from 'yuka';

const GAZE_TIMER_MIN = 12;
const GAZE_TIMER_MAX = 20;
const GAZE_TRANSITION_SPEED = 1.5;
const AFK_THRESHOLD_MS = 30_000;
const AUTONOMOUS_ROT_SMOOTH = 0.08;

export class GazeSystem {
  blendFactor = 0;
  autonomousRotY = 0;
  autonomousRotX = 0;

  private mode: 'mouse' | 'autonomous' = 'mouse';
  private timer: number;
  private isPageVisible = true;
  private onVisibilityChange: () => void;

  constructor() {
    this.timer = Math.random() * (GAZE_TIMER_MAX - GAZE_TIMER_MIN) + GAZE_TIMER_MIN;
    this.onVisibilityChange = () => { this.isPageVisible = !document.hidden; };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update(
    delta: number,
    lastMoveTimestamp: number,
    yukaVehicle: YUKA.Vehicle | null,
    yukaActive: boolean,
  ): void {
    const clampedDelta = Math.min(delta, 0.033);
    const msSinceLastMove = Date.now() - lastMoveTimestamp;
    const isAfk = msSinceLastMove > AFK_THRESHOLD_MS;

    // Determine probability of autonomous gaze
    let autonomousProb: number;
    if (!this.isPageVisible) {
      autonomousProb = 1.0;
    } else if (isAfk) {
      autonomousProb = 0.8;
    } else {
      autonomousProb = 0.5;
    }

    // Timer-based mode switching
    this.timer -= delta;
    if (this.timer <= 0) {
      this.mode = Math.random() < autonomousProb ? 'autonomous' : 'mouse';
      this.timer = Math.random() * (GAZE_TIMER_MAX - GAZE_TIMER_MIN) + GAZE_TIMER_MIN;
    }

    // Calculate autonomous rotation from vehicle velocity
    if (yukaActive && yukaVehicle) {
      const vel = yukaVehicle.velocity;
      const xySpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (xySpeed > 0.01) {
        const rawRotY = Math.atan2(vel.x, 1.0);
        let deltaAngle = rawRotY - this.autonomousRotY;
        if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        this.autonomousRotY += deltaAngle * AUTONOMOUS_ROT_SMOOTH;

        const rawRotX = Math.atan2(-vel.y, 1.0) * 0.3;
        this.autonomousRotX = MathUtils.lerp(this.autonomousRotX, rawRotX, AUTONOMOUS_ROT_SMOOTH);
      }
    }

    // Blend toward target mode
    const gazeTarget = this.mode === 'autonomous' ? 1.0 : 0.0;
    this.blendFactor = MathUtils.lerp(this.blendFactor, gazeTarget, GAZE_TRANSITION_SPEED * clampedDelta);
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
