import type {
  Dwell, TextElementLayout, CameraKeyframe, CardLayout, InstanceLifecycle,
  ComputedElement, ComputedCamera, ComputedCard,
  VisualKeyframe, VisualKeyframeMaterialGroup, ComputedVisualState,
  ElementTransformKf, ComputedElementTransform,
  EyeWaypoint, TimelineContext, TimelineComputed,
} from './types.ts';
import { applyEasing, EASING_MAP } from '../../utils/easing.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_TOTAL_FRAMES = 150;
export const SCROLL_TEXT_OFFSET_X = -20;
export const SCROLL_TEXT_EXIT_Z_OFFSET = 7.8;

// ── Pure compute functions (exported for scene systems) ───────────────────────

export function computeElementState(layout: TextElementLayout, frame: number): ComputedElement {
  // Phase 1: Before entrance
  if (frame <= layout.scrollStart) {
    return { x: layout.startX, y: layout.startY, z: layout.startZ, opacity: 0 };
  }
  // Phase 2: Entrance (start → end)
  if (frame < layout.scrollEnd) {
    const range = layout.scrollEnd - layout.scrollStart;
    const tRaw = range > 0 ? (frame - layout.scrollStart) / range : 1;
    const t = applyEasing(layout.easing, tRaw);
    return {
      x: layout.startX + (layout.endX - layout.startX) * t,
      y: layout.startY + (layout.endY - layout.startY) * t,
      z: layout.startZ + (layout.endZ - layout.startZ) * t,
      opacity: t,
    };
  }
  // Phase 3: Steady (hold at end position)
  if (frame < layout.exitStart) {
    return { x: layout.endX, y: layout.endY, z: layout.endZ, opacity: 1 };
  }
  // Phase 4: Exit (end → exit)
  if (frame < layout.exitEnd) {
    const range = layout.exitEnd - layout.exitStart;
    const tRaw = range > 0 ? (frame - layout.exitStart) / range : 1;
    const t = applyEasing(layout.exitEasing, tRaw);
    return {
      x: layout.endX + (layout.exitX - layout.endX) * t,
      y: layout.endY + (layout.exitY - layout.endY) * t,
      z: layout.endZ + (layout.exitZ - layout.endZ) * t,
      opacity: 1 - t,
    };
  }
  // Phase 5: After exit
  return { x: layout.exitX, y: layout.exitY, z: layout.exitZ, opacity: 0 };
}

export function computeCameraState(keyframes: CameraKeyframe[], frame: number): ComputedCamera | null {
  if (keyframes.length === 0) return null;

  const first = keyframes[0];
  if (frame <= first.at) {
    return { posX: first.posX, posY: first.posY, posZ: first.posZ, lookAtX: first.lookAtX, lookAtY: first.lookAtY, lookAtZ: first.lookAtZ, fov: first.fov };
  }

  const last = keyframes[keyframes.length - 1];
  if (frame >= last.at) {
    return { posX: last.posX, posY: last.posY, posZ: last.posZ, lookAtX: last.lookAtX, lookAtY: last.lookAtY, lookAtZ: last.lookAtZ, fov: last.fov };
  }

  // Find surrounding keyframes
  let fromIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (frame >= keyframes[i].at && frame < keyframes[i + 1].at) {
      fromIdx = i;
      break;
    }
  }

  const from = keyframes[fromIdx];
  const to = keyframes[fromIdx + 1];
  const range = to.at - from.at;
  const tLocal = range > 0 ? (frame - from.at) / range : 0;
  const easingFn = EASING_MAP[to.easing] ?? EASING_MAP.linear;
  const t = easingFn(tLocal);

  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    posX: lerp(from.posX, to.posX),
    posY: lerp(from.posY, to.posY),
    posZ: lerp(from.posZ, to.posZ),
    lookAtX: lerp(from.lookAtX, to.lookAtX),
    lookAtY: lerp(from.lookAtY, to.lookAtY),
    lookAtZ: lerp(from.lookAtZ, to.lookAtZ),
    fov: lerp(from.fov, to.fov),
  };
}

export function computeCardState(layout: CardLayout, frame: number): ComputedCard {
  // Phase 1: Before entrance
  if (frame <= layout.scrollStart) return { opacity: 0, translateX: 100 };
  // Phase 2: Enter (scrollStart → scrollEnd)
  if (frame < layout.scrollEnd) {
    const range = layout.scrollEnd - layout.scrollStart;
    const tRaw = range > 0 ? (frame - layout.scrollStart) / range : 1;
    const t = applyEasing(layout.easing, tRaw);
    return { opacity: t, translateX: 100 * (1 - t) };
  }
  // Phase 3: Steady
  if (frame < layout.exitStart) return { opacity: 1, translateX: 0 };
  // Phase 4: Exit (exitStart → exitEnd)
  if (frame < layout.exitEnd) {
    const range = layout.exitEnd - layout.exitStart;
    const tRaw = range > 0 ? (frame - layout.exitStart) / range : 1;
    const t = applyEasing(layout.exitEasing, tRaw);
    return { opacity: 1 - t, translateX: -100 * t };
  }
  // Phase 5: After exit
  return { opacity: 0, translateX: -100 };
}

export function computeLifecycleOpacity(layout: InstanceLifecycle, frame: number): number {
  if (frame <= layout.scrollStart) return 0;
  if (frame < layout.scrollEnd) {
    const range = layout.scrollEnd - layout.scrollStart;
    return applyEasing(layout.easing, range > 0 ? (frame - layout.scrollStart) / range : 1);
  }
  if (frame < layout.exitStart) return 1;
  if (frame < layout.exitEnd) {
    const range = layout.exitEnd - layout.exitStart;
    return 1 - applyEasing(layout.exitEasing, range > 0 ? (frame - layout.exitStart) / range : 1);
  }
  return 0;
}

// ── Visual keyframe compute ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function lerpMaterialGroup(a: VisualKeyframeMaterialGroup, b: VisualKeyframeMaterialGroup, t: number): VisualKeyframeMaterialGroup {
  return {
    emissiveColor: lerpColor(a.emissiveColor, b.emissiveColor, t),
    emissiveIntensity: a.emissiveIntensity + (b.emissiveIntensity - a.emissiveIntensity) * t,
  };
}

function lerpVisualState(a: VisualKeyframe, b: VisualKeyframe, t: number): ComputedVisualState {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const snap = (x: boolean, y: boolean) => t < 0.5 ? x : y;
  return {
    bloom: {
      enabled: snap(a.bloom.enabled, b.bloom.enabled),
      color: lerpColor(a.bloom.color, b.bloom.color, t),
      strength: lerp(a.bloom.strength, b.bloom.strength),
      threshold: lerp(a.bloom.threshold, b.bloom.threshold),
      radius: lerp(a.bloom.radius, b.bloom.radius),
    },
    lighting: {
      ambientIntensity: lerp(a.lighting.ambientIntensity, b.lighting.ambientIntensity),
      directionalIntensity: lerp(a.lighting.directionalIntensity, b.lighting.directionalIntensity),
      pointIntensity: lerp(a.lighting.pointIntensity, b.lighting.pointIntensity),
      exposure: lerp(a.lighting.exposure, b.lighting.exposure),
      hdrBoostEnabled: snap(a.lighting.hdrBoostEnabled, b.lighting.hdrBoostEnabled),
      hdrBoostMultiplier: lerp(a.lighting.hdrBoostMultiplier, b.lighting.hdrBoostMultiplier),
    },
    material: {
      iris: lerpMaterialGroup(a.material.iris, b.material.iris, t),
      eyeRings: lerpMaterialGroup(a.material.eyeRings, b.material.eyeRings, t),
      revealRings: lerpMaterialGroup(a.material.revealRings, b.material.revealRings, t),
    },
    scene: {
      backgroundColor: lerpColor(a.scene.backgroundColor, b.scene.backgroundColor, t),
    },
    neon: {
      flowSpeed: lerp(a.neon.flowSpeed, b.neon.flowSpeed),
      flowEnabled: snap(a.neon.flowEnabled, b.neon.flowEnabled),
      globalIntensity: lerp(a.neon.globalIntensity, b.neon.globalIntensity),
    },
  };
}

function visualStateFromKeyframe(kf: VisualKeyframe): ComputedVisualState {
  return {
    bloom: { ...kf.bloom },
    lighting: { ...kf.lighting },
    material: {
      iris: { ...kf.material.iris },
      eyeRings: { ...kf.material.eyeRings },
      revealRings: { ...kf.material.revealRings },
    },
    scene: { ...kf.scene },
    neon: { ...kf.neon },
  };
}

export function computeVisualState(keyframes: VisualKeyframe[], frame: number): ComputedVisualState | null {
  if (keyframes.length === 0) return null;

  // Sort by at (should already be sorted, but just in case)
  const sorted = keyframes.length > 1 ? [...keyframes].sort((a, b) => a.at - b.at) : keyframes;

  // Find the clip that contains this frame
  for (let i = 0; i < sorted.length; i++) {
    const clip = sorted[i];
    const clipEnd = clip.at + clip.duration;

    if (frame < clip.at || frame >= clipEnd) continue;

    const localFrame = frame - clip.at;

    // Enter zone: interpolate from previous clip (or no previous → just this clip fading in)
    if (localFrame < clip.enterDuration && clip.enterDuration > 0) {
      const tRaw = localFrame / clip.enterDuration;
      const t = applyEasing(clip.easing, tRaw);
      const prev = i > 0 ? sorted[i - 1] : null;
      if (prev) {
        return lerpVisualState(prev, clip, t);
      }
      // No previous clip — just return current (no fade from nothing)
      return visualStateFromKeyframe(clip);
    }

    // Exit zone: interpolate towards next clip
    const exitLocalStart = clip.duration - clip.exitDuration;
    if (localFrame >= exitLocalStart && clip.exitDuration > 0) {
      const tRaw = (localFrame - exitLocalStart) / clip.exitDuration;
      const t = applyEasing(clip.easing, tRaw);
      const next = i < sorted.length - 1 ? sorted[i + 1] : null;
      if (next) {
        return lerpVisualState(clip, next, t);
      }
      // No next clip — just return current
      return visualStateFromKeyframe(clip);
    }

    // Steady zone: return clip values as-is
    return visualStateFromKeyframe(clip);
  }

  // Frame is not inside any clip — no visual override
  return null;
}

// ── Dwell remap ───────────────────────────────────────────────────────────────

/**
 * Convert a raw frame (includes dwell pauses) to an effective frame.
 * Dwells insert "pause" frames at specific effective positions.
 */
export function remapFrames(rawFrame: number, dwells: Dwell[]): number {
  if (dwells.length === 0) return rawFrame;

  const sorted = [...dwells].sort((a, b) => a.at - b.at);
  let dwellOffset = 0;

  for (const dwell of sorted) {
    const rawStart = dwell.at + dwellOffset;
    const rawEnd = rawStart + dwell.duration;

    if (rawFrame < rawStart) break;
    if (rawFrame < rawEnd) return dwell.at; // inside dwell — freeze
    dwellOffset += dwell.duration;
  }

  return rawFrame - dwellOffset;
}

/**
 * Total raw frames = totalFrames + sum of dwell durations.
 * Determines page scroll height.
 */
export function getTotalRawFrames(totalFrames: number, dwells: Dwell[]): number {
  return totalFrames + dwells.reduce((s, d) => s + d.duration, 0);
}

// ── Element track compute ────────────────────────────────────────────────────

export function computeElementTrackTransform(
  keyframes: ElementTransformKf[],
  frame: number,
): ComputedElementTransform | null {
  if (keyframes.length === 0) return null;

  const first = keyframes[0];
  if (keyframes.length === 1 || frame <= first.frame) {
    return { position: { ...first.position }, rotation: { ...first.rotation }, scale: first.scale };
  }

  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) {
    return { position: { ...last.position }, rotation: { ...last.rotation }, scale: last.scale };
  }

  // Find surrounding keyframes
  let fromIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (frame >= keyframes[i].frame && frame < keyframes[i + 1].frame) {
      fromIdx = i;
      break;
    }
  }

  const from = keyframes[fromIdx];
  const to = keyframes[fromIdx + 1];
  const range = to.frame - from.frame;
  const tLocal = range > 0 ? (frame - from.frame) / range : 0;
  const easingFn = EASING_MAP[to.easing] ?? EASING_MAP.linear;
  const t = easingFn(tLocal);

  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    position: {
      x: lerp(from.position.x, to.position.x),
      y: lerp(from.position.y, to.position.y),
      z: lerp(from.position.z, to.position.z),
    },
    rotation: {
      x: lerp(from.rotation.x, to.rotation.x),
      y: lerp(from.rotation.y, to.rotation.y),
      z: lerp(from.rotation.z, to.rotation.z),
    },
    scale: lerp(from.scale, to.scale),
  };
}

// ── Eye waypoint interpolation ───────────────────────────────────────────────

function computeEyeWaypointTarget(
  waypoints: EyeWaypoint[], frame: number
): { x: number; y: number; z: number } | null {
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) return waypoints[0].target;
  if (frame <= waypoints[0].frame) return waypoints[0].target;
  if (frame >= waypoints[waypoints.length - 1].frame)
    return waypoints[waypoints.length - 1].target;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (frame >= waypoints[i].frame && frame <= waypoints[i + 1].frame) {
      const raw = (frame - waypoints[i].frame) / (waypoints[i + 1].frame - waypoints[i].frame);
      const t = applyEasing(waypoints[i].easing, raw);
      const a = waypoints[i].target, b = waypoints[i + 1].target;
      return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
        z: a.z + t * (b.z - a.z),
      };
    }
  }
  return waypoints[waypoints.length - 1].target;
}

// ── Recompute helper ──────────────────────────────────────────────────────────

export function recompute(ctx: TimelineContext): TimelineComputed {
  const f = ctx.currentFrame;
  const elementTransforms: Record<string, ComputedElementTransform | null> = {};
  for (const [id, kfs] of Object.entries(ctx.elementTracks)) {
    elementTransforms[id] = computeElementTrackTransform(kfs, f);
  }
  return {
    camera: ctx.cameraEnabled ? computeCameraState(ctx.cameraKeyframes, f) : null,
    title: computeElementState(ctx.titleLayout, f),
    subtitle: computeElementState(ctx.subtitleLayout, f),
    card: computeCardState(ctx.cardLayout, f),
    instanceOpacities: Object.fromEntries(
      Object.entries(ctx.instanceLifecycles).map(([id, lc]) => [id, computeLifecycleOpacity(lc, f)]),
    ),
    visual: ctx.visualEnabled ? computeVisualState(ctx.visualKeyframes, f) : null,
    elementTransforms,
    eyeTarget: computeEyeWaypointTarget(ctx.eyeWaypoints, f),
  };
}

export function sortKeyframes(kfs: CameraKeyframe[]): CameraKeyframe[] {
  return [...kfs].sort((a, b) => a.at - b.at);
}
