import { MathUtils } from 'three';

const MAX_ROT_Y = Math.PI / 3;  // ±60°
const MAX_ROT_X = Math.PI / 6;  // ±30°
const DEAD_ZONE = 0.1;
const INACTIVE_MS = 3000;

export class InputTracker {
  targetRotY = 0;
  targetRotX = 0;
  currentRotY = 0;
  currentRotX = 0;
  mouseNDC = { x: 0, y: 0 };
  isActive = false;
  lastMoveTimestamp = Date.now();

  private inactiveTimer = 0;

  attach(): () => void {
    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = -(e.clientY / window.innerHeight - 0.5) * 2;
      this.mouseNDC.x = nx;
      this.mouseNDC.y = ny;

      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist < DEAD_ZONE) {
        this.targetRotY = 0;
        this.targetRotX = 0;
      } else {
        this.targetRotY = MathUtils.clamp(nx * MAX_ROT_Y, -MAX_ROT_Y, MAX_ROT_Y);
        this.targetRotX = MathUtils.clamp(-ny * MAX_ROT_X, -MAX_ROT_X, MAX_ROT_X);
      }

      this.isActive = true;
      this.inactiveTimer = 0;
      this.lastMoveTimestamp = Date.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const nx = (touch.clientX / window.innerWidth - 0.5) * 2;
      const ny = -(touch.clientY / window.innerHeight - 0.5) * 2;
      this.mouseNDC.x = nx;
      this.mouseNDC.y = ny;

      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist < DEAD_ZONE) {
        this.targetRotY = 0;
        this.targetRotX = 0;
      } else {
        this.targetRotY = MathUtils.clamp(nx * MAX_ROT_Y, -MAX_ROT_Y, MAX_ROT_Y);
        this.targetRotX = MathUtils.clamp(-ny * MAX_ROT_X, -MAX_ROT_X, MAX_ROT_X);
      }

      this.isActive = true;
      this.inactiveTimer = 0;
      this.lastMoveTimestamp = Date.now();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }

  update(delta: number, lerpFactor: number): void {
    this.inactiveTimer += delta * 1000;
    if (this.inactiveTimer > INACTIVE_MS) {
      this.isActive = false;
      this.targetRotY = 0;
      this.targetRotX = 0;
    }
    this.currentRotY = MathUtils.lerp(this.currentRotY, this.targetRotY, lerpFactor);
    this.currentRotX = MathUtils.lerp(this.currentRotX, this.targetRotX, lerpFactor);
  }
}
