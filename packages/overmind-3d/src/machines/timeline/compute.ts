import type {
  Dwell, TextElementLayout, CameraKeyframe, CardLayout, InstanceLifecycle,
  ComputedElement, ComputedCamera, ComputedCard,
  VisualKeyframe, VisualKeyframeMaterialGroup, ComputedVisualState,
  ElementTransformKf, ComputedElementTransform,
  EyePath, EyePathPoint, ComputedEyePathState,
  FollowPathAssignment, ComputedFollowPathState,
  TimelineContext, TimelineComputed,
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

// ── Eye path compute (cubic Bézier + arc-length) ────────────────────────────

type Vec3 = { x: number; y: number; z: number };

/** Cubic Bézier evaluation: B(t) = (1-t)³P0 + 3(1-t)²tC0 + 3(1-t)t²C1 + t³P1 */
export function cubicBezierPoint(p0: Vec3, c0: Vec3, c1: Vec3, p1: Vec3, t: number): Vec3 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
    y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
    z: a * p0.z + b * c0.z + c * c1.z + d * p1.z,
  };
}

/**
 * Auto-compute Bézier handles for a point based on neighboring positions.
 * Uses uniform CatmullRom tangent: T_i = 0.5 * (P[i+1] - P[i-1]).
 * handleOut = P + T/3, handleIn = P - T/3.
 */
export function autoComputeHandles(
  points: EyePathPoint[],
  index: number,
): { handleIn: Vec3; handleOut: Vec3 } {
  const n = points.length;
  const P = points[index].position;
  const prev = points[Math.max(0, index - 1)].position;
  const next = points[Math.min(n - 1, index + 1)].position;

  const tx = 0.5 * (next.x - prev.x);
  const ty = 0.5 * (next.y - prev.y);
  const tz = 0.5 * (next.z - prev.z);

  return {
    handleIn:  { x: P.x - tx / 3, y: P.y - ty / 3, z: P.z - tz / 3 },
    handleOut: { x: P.x + tx / 3, y: P.y + ty / 3, z: P.z + tz / 3 },
  };
}

/**
 * Ensure all points have handles. Auto-type points get recomputed handles;
 * aligned/free points with existing handles are preserved.
 */
export function ensureHandles(points: EyePathPoint[]): EyePathPoint[] {
  return points.map((pt, i) => {
    const type = pt.handleType ?? 'auto';
    if (type !== 'auto' && pt.handleIn && pt.handleOut) return pt;
    const { handleIn, handleOut } = autoComputeHandles(points, i);
    return {
      ...pt,
      handleIn: (type !== 'auto' && pt.handleIn) ? pt.handleIn : handleIn,
      handleOut: (type !== 'auto' && pt.handleOut) ? pt.handleOut : handleOut,
      handleType: type,
    };
  });
}

/**
 * Enforce aligned constraint: opposite handle stays colinear but keeps its length.
 * Mutates point in place.
 */
export function enforceAlignedConstraint(
  point: EyePathPoint,
  movedSide: 'in' | 'out',
): void {
  const pos = point.position;
  const moved = movedSide === 'in' ? point.handleIn : point.handleOut;
  const other = movedSide === 'in' ? point.handleOut : point.handleIn;
  if (!moved || !other) return;

  const dx = moved.x - pos.x;
  const dy = moved.y - pos.y;
  const dz = moved.z - pos.z;
  const movedLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (movedLen < 1e-10) return;

  const ox = other.x - pos.x;
  const oy = other.y - pos.y;
  const oz = other.z - pos.z;
  const otherLen = Math.sqrt(ox * ox + oy * oy + oz * oz);

  const scale = -otherLen / movedLen;
  const newOther = {
    x: pos.x + dx * scale,
    y: pos.y + dy * scale,
    z: pos.z + dz * scale,
  };
  if (movedSide === 'in') {
    point.handleOut = newOther;
  } else {
    point.handleIn = newOther;
  }
}

/**
 * Subdivide a Bézier segment at t=0.5 using de Casteljau's algorithm.
 * Returns a new EyePathPoint at the midpoint with interpolated frame.
 */
export function subdivideBezierSegment(points: EyePathPoint[], segIndex: number): EyePathPoint | null {
  if (segIndex < 0 || segIndex >= points.length - 1) return null;
  const pt0 = points[segIndex];
  const pt1 = points[segIndex + 1];

  const p0 = pt0.position;
  const c0 = pt0.handleOut ?? p0;
  const c1 = pt1.handleIn ?? pt1.position;
  const p1 = pt1.position;

  const midPos = cubicBezierPoint(p0, c0, c1, p1, 0.5);
  const midFrame = Math.round((pt0.frame + pt1.frame) / 2);

  return {
    position: midPos,
    frame: midFrame,
    dwellFrames: 0,
    easing: pt0.easing,
    handleType: 'auto',
  };
}

// Arc-length parameterization

const ARC_SAMPLES = 64;

interface ArcLengthTable {
  distances: number[];
  tValues: number[];
  totalLength: number;
}

function buildBezierArcTable(
  p0: Vec3, c0: Vec3, c1: Vec3, p1: Vec3, samples: number,
): ArcLengthTable {
  const distances: number[] = [0];
  const tValues: number[] = [0];
  let prev = cubicBezierPoint(p0, c0, c1, p1, 0);
  let cumulative = 0;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const pt = cubicBezierPoint(p0, c0, c1, p1, t);
    const dx = pt.x - prev.x, dy = pt.y - prev.y, dz = pt.z - prev.z;
    cumulative += Math.sqrt(dx * dx + dy * dy + dz * dz);
    distances.push(cumulative);
    tValues.push(t);
    prev = pt;
  }
  return { distances, tValues, totalLength: cumulative };
}

function arcLengthToT(table: ArcLengthTable, targetDist: number): number {
  const { distances, tValues } = table;
  if (targetDist <= 0) return 0;
  if (targetDist >= table.totalLength) return 1;

  let lo = 0, hi = distances.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (distances[mid] < targetDist) lo = mid;
    else hi = mid;
  }
  const segLen = distances[hi] - distances[lo];
  const frac = segLen > 0 ? (targetDist - distances[lo]) / segLen : 0;
  return tValues[lo] + (tValues[hi] - tValues[lo]) * frac;
}

// Eye path dwell remap

function remapEyePathFrame(
  frame: number, points: EyePathPoint[],
): { progress: number; frozen: boolean } {
  const first = points[0].frame;
  const last = points[points.length - 1].frame;
  const movingRange = last - first;
  if (movingRange <= 0) return { progress: 0, frozen: true };

  let dwellOffset = 0;
  for (const pt of points) {
    if (pt.dwellFrames <= 0) continue;
    const rawStart = pt.frame + dwellOffset;
    const rawEnd = rawStart + pt.dwellFrames;
    if (frame < rawStart) break;
    if (frame < rawEnd) {
      return { progress: (pt.frame - first) / movingRange, frozen: true };
    }
    dwellOffset += pt.dwellFrames;
  }

  const effective = frame - dwellOffset;
  return {
    progress: Math.max(0, Math.min(1, (effective - first) / movingRange)),
    frozen: false,
  };
}

// Main compute function

export function computeEyePathState(
  eyePath: EyePath, frame: number,
): ComputedEyePathState | null {
  const { points, transitionIn, transitionOut, enabled, maxInfluence } = eyePath;
  if (!enabled || points.length < 2) return null;

  const firstFrame = points[0].frame;
  const lastFrame = points[points.length - 1].frame;
  const totalDwell = points.reduce((s, p) => s + p.dwellFrames, 0);
  const pathEnd = lastFrame + totalDwell;

  const activeStart = firstFrame - transitionIn;
  const activeEnd = pathEnd + transitionOut;

  if (frame < activeStart || frame > activeEnd) return null;

  // Blend factor
  let blend: number;
  if (frame < firstFrame) {
    blend = transitionIn > 0 ? (frame - activeStart) / transitionIn : 1;
  } else if (frame > pathEnd) {
    blend = transitionOut > 0 ? 1 - (frame - pathEnd) / transitionOut : 0;
  } else {
    blend = 1;
  }
  blend = Math.max(0, Math.min(1, blend));
  // Smoothstep for natural transitions
  blend = blend * blend * (3 - 2 * blend);
  // Cap to maxInfluence
  const cap = maxInfluence ?? 0.8;
  blend = Math.min(blend, cap);

  // Position + tangent on curve
  const clampedFrame = Math.max(firstFrame, Math.min(pathEnd, frame));
  const { progress } = remapEyePathFrame(clampedFrame, points);
  const { position, tangent } = evaluateCurveWithTangent(points, progress);

  return {
    position,
    tangent: blend > 0.5 ? tangent : null,
    blend,
    repulsionScale: 1 - blend * 0.7,
  };
}

// ── Follow Path compute ──────────────────────────────────────────────────────

/** Cubic Bézier tangent (first derivative): B'(t) = 3(1-t)²(C0-P0) + 6(1-t)t(C1-C0) + 3t²(P1-C1) */
export function cubicBezierTangent(p0: Vec3, c0: Vec3, c1: Vec3, p1: Vec3, t: number): Vec3 {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  return {
    x: a * (c0.x - p0.x) + b * (c1.x - c0.x) + c * (p1.x - c1.x),
    y: a * (c0.y - p0.y) + b * (c1.y - c0.y) + c * (p1.y - c1.y),
    z: a * (c0.z - p0.z) + b * (c1.z - c0.z) + c * (p1.z - c1.z),
  };
}

/** Evaluate position + tangent on the eye path curve at a given progress [0..1]. */
export function evaluateCurveWithTangent(
  points: EyePathPoint[], progress: number,
): { position: Vec3; tangent: Vec3 } {
  if (points.length < 2) {
    return { position: points[0].position, tangent: { x: 0, y: 0, z: 1 } };
  }

  const n = points.length;

  // Build per-segment arc-length tables
  const segTables: ArcLengthTable[] = [];
  const segLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i].position;
    const c0 = points[i].handleOut ?? p0;
    const c1 = points[i + 1].handleIn ?? points[i + 1].position;
    const p1 = points[i + 1].position;
    const table = buildBezierArcTable(p0, c0, c1, p1, ARC_SAMPLES);
    segTables.push(table);
    segLengths.push(table.totalLength);
    totalLength += table.totalLength;
  }

  if (totalLength < 1e-10) {
    return { position: points[0].position, tangent: { x: 0, y: 0, z: 1 } };
  }

  const targetDist = progress * totalLength;

  let accum = 0;
  for (let i = 0; i < segTables.length; i++) {
    const segLen = segLengths[i];
    if (accum + segLen >= targetDist || i === segTables.length - 1) {
      const localDist = targetDist - accum;
      const localProgress = segLen > 0 ? localDist / segLen : 0;
      const easedProgress = applyEasing(points[i].easing, localProgress);
      const easedDist = easedProgress * segLen;
      const t = arcLengthToT(segTables[i], easedDist);

      const p0 = points[i].position;
      const c0 = points[i].handleOut ?? p0;
      const c1 = points[i + 1].handleIn ?? points[i + 1].position;
      const p1 = points[i + 1].position;
      return {
        position: cubicBezierPoint(p0, c0, c1, p1, t),
        tangent: cubicBezierTangent(p0, c0, c1, p1, t),
      };
    }
    accum += segLen;
  }

  return { position: points[n - 1].position, tangent: { x: 0, y: 0, z: 1 } };
}

/** Compute follow-path states for all assignments at a given frame. */
export function computeFollowPathStates(
  eyePath: EyePath, assignments: FollowPathAssignment[], frame: number,
): Record<string, ComputedFollowPathState> {
  const result: Record<string, ComputedFollowPathState> = {};
  const { points, enabled } = eyePath;
  if (!enabled || points.length < 2 || assignments.length === 0) return result;

  const firstFrame = points[0].frame;
  const lastFrame = points[points.length - 1].frame;
  const totalDwell = points.reduce((s, p) => s + p.dwellFrames, 0);
  const pathEnd = lastFrame + totalDwell;
  const movingRange = pathEnd - firstFrame;
  if (movingRange <= 0) return result;

  for (const a of assignments) {
    const effectiveFrame = frame + a.frameOffset;
    const clamped = Math.max(firstFrame, Math.min(pathEnd, effectiveFrame));
    const { progress } = remapEyePathFrame(clamped, points);
    const { position, tangent } = evaluateCurveWithTangent(points, progress);
    result[a.instanceId] = {
      position,
      tangent: a.followTangent ? tangent : null,
      influence: a.influence,
    };
  }
  return result;
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
    eyePathState: computeEyePathState(ctx.eyePath, f),
    followPathStates: computeFollowPathStates(ctx.eyePath, ctx.followPathAssignments, f),
  };
}

export function sortKeyframes(kfs: CameraKeyframe[]): CameraKeyframe[] {
  return [...kfs].sort((a, b) => a.at - b.at);
}
