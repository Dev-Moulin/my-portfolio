// ── Timeline Types ──────────────────────────────────────────────────────────

export type TrackId = 'camera' | 'eye' | 'title' | 'subtitle' | 'card' | 'visual' | `el:${string}`;
export type ClipEdge = 'start' | 'enterEnd' | 'exitStart' | 'end';

export const DEFAULT_TRACK_ORDER: TrackId[] = ['camera', 'eye', 'title', 'subtitle', 'card', 'visual'];

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
  | { kind: 'visual-slide'; index: number; grabOffset: number; originalAt: number }
  | { kind: 'element-keyframe'; elementId: string }
  | { kind: 'eye-waypoint' }
  | { kind: 'track-reorder'; trackId: TrackId };
