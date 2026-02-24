import * as THREE from 'three';
import type { CameraKeyframe, CameraKeyframeContext } from '../machines/cameraKeyframeMachine.ts';
import { EASING_MAP } from '../utils/easing.ts';

// ── CameraKeyframeSystem ─────────────────────────────────────────────────────

export class CameraKeyframeSystem {
  private camera: THREE.PerspectiveCamera;
  private keyframes: CameraKeyframe[] = [];
  private enabled = false;

  private currentProgress = 0;
  private targetProgress = 0;

  // Reusable vector to avoid GC
  private lookAtTarget = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, initialCtx: CameraKeyframeContext) {
    this.camera = camera;
    this.syncFromState(initialCtx);
  }

  syncFromState(ctx: CameraKeyframeContext): void {
    this.keyframes = ctx.keyframes;
    this.enabled = ctx.enabled;
    this.targetProgress = ctx.scrollProgress;
  }

  update(delta: number): void {
    if (!this.enabled || this.keyframes.length === 0) return;

    // Smooth lerp toward target scroll
    const lerpSpeed = 1 - Math.pow(0.001, delta);
    this.currentProgress = THREE.MathUtils.lerp(
      this.currentProgress,
      this.targetProgress,
      lerpSpeed,
    );

    const { posX, posY, posZ, lookAtX, lookAtY, lookAtZ, fov } =
      this.interpolate(this.currentProgress);

    this.camera.position.set(posX, posY, posZ);
    this.lookAtTarget.set(lookAtX, lookAtY, lookAtZ);
    this.camera.lookAt(this.lookAtTarget);

    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private interpolate(progress: number): {
    posX: number; posY: number; posZ: number;
    lookAtX: number; lookAtY: number; lookAtZ: number;
    fov: number;
  } {
    const kfs = this.keyframes;

    // Before first keyframe
    if (progress <= kfs[0].at) {
      return this.kfValues(kfs[0]);
    }

    // After last keyframe
    if (progress >= kfs[kfs.length - 1].at) {
      return this.kfValues(kfs[kfs.length - 1]);
    }

    // Find surrounding keyframes
    let fromIdx = 0;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (progress >= kfs[i].at && progress < kfs[i + 1].at) {
        fromIdx = i;
        break;
      }
    }

    const from = kfs[fromIdx];
    const to = kfs[fromIdx + 1];
    const range = to.at - from.at;
    const tLocal = range > 0 ? (progress - from.at) / range : 0;

    // Use the easing of the destination keyframe
    const easingFn = EASING_MAP[to.easing] ?? EASING_MAP.linear;
    const t = easingFn(tLocal);

    return {
      posX: THREE.MathUtils.lerp(from.posX, to.posX, t),
      posY: THREE.MathUtils.lerp(from.posY, to.posY, t),
      posZ: THREE.MathUtils.lerp(from.posZ, to.posZ, t),
      lookAtX: THREE.MathUtils.lerp(from.lookAtX, to.lookAtX, t),
      lookAtY: THREE.MathUtils.lerp(from.lookAtY, to.lookAtY, t),
      lookAtZ: THREE.MathUtils.lerp(from.lookAtZ, to.lookAtZ, t),
      fov: THREE.MathUtils.lerp(from.fov, to.fov, t),
    };
  }

  private kfValues(kf: CameraKeyframe) {
    return {
      posX: kf.posX, posY: kf.posY, posZ: kf.posZ,
      lookAtX: kf.lookAtX, lookAtY: kf.lookAtY, lookAtZ: kf.lookAtZ,
      fov: kf.fov,
    };
  }
}
