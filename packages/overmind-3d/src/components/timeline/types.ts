// ── Timeline Types ──────────────────────────────────────────────────────────

export type TrackId = 'camera' | 'eye-path' | 'title' | 'subtitle' | 'card' | 'visual' | `el:${string}`;
export type ClipEdge = 'start' | 'enterEnd' | 'exitStart' | 'end';

export const DEFAULT_TRACK_ORDER: TrackId[] = ['camera', 'eye-path', 'title', 'subtitle', 'card', 'visual'];

export interface ClipOriginal {
  scrollStart: number;
  scrollEnd: number;
  exitStart: number;
  exitEnd: number;
}

export type DragState =
  | { kind: 'clip-edge'; trackId: TrackId; edge: ClipEdge }
  | { kind: 'clip-slide'; trackId: TrackId; grabOffset: number; original: ClipOriginal }
  | { kind: 'keyframe' }
  | { kind: 'dwell' }
  | { kind: 'visual-edge'; index: number; edge: ClipEdge }
  | { kind: 'visual-slide'; index: number; grabOffset: number }
  | { kind: 'element-keyframe'; elementId: string }
  | { kind: 'eye-path-point' }
  | { kind: 'track-reorder'; trackId: TrackId }
  | { kind: 'diamond-grab'; initialFrames: Map<string, number> };

// ── Clipboard ────────────────────────────────────────────────────────────────

export interface ClipboardEntry {
  track: 'camera' | 'element' | 'eye-path' | 'dwell';
  elementId?: string;
  frameOffset: number;  // relative to the first copied diamond
  data: Record<string, unknown>;  // snapshot of the keyframe data
}

// ── Snap guide ───────────────────────────────────────────────────────────────

export interface SnapGuide {
  frame: number;
}

// ── Diamond selection ──────────────────────────────────────────────────────

export interface DiamondRef {
  track: 'camera' | 'dwell' | 'eye-path' | 'element';
  elementId?: string;   // required when track === 'element'
  frame: number;        // unique within a given track
}

export function diamondEquals(a: DiamondRef, b: DiamondRef): boolean {
  return a.track === b.track && a.frame === b.frame
    && (a.elementId ?? '') === (b.elementId ?? '');
}

export function isDiamondSelected(diamonds: DiamondRef[], d: DiamondRef): boolean {
  return diamonds.some(s => diamondEquals(s, d));
}
