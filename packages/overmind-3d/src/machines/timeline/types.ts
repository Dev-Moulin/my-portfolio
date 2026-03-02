import type { EasingType } from '../../utils/easing.ts';
export type { EasingType } from '../../utils/easing.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Dwell {
  at: number;       // effective frame where progress pauses
  duration: number; // raw frames the pause lasts
}

export interface CameraKeyframe {
  at: number;
  posX: number; posY: number; posZ: number;
  lookAtX: number; lookAtY: number; lookAtZ: number;
  fov: number;
  easing: EasingType;
}

export interface TextElementLayout {
  startX: number; startY: number; startZ: number;
  endX: number;   endY: number;   endZ: number;
  scrollStart: number;
  scrollEnd: number;
  easing: EasingType;
  exitX: number; exitY: number; exitZ: number;
  exitStart: number;
  exitEnd: number;
  exitEasing: EasingType;
}

export interface InstanceLifecycle {
  scrollStart: number;
  scrollEnd: number;
  easing: EasingType;
  exitStart: number;
  exitEnd: number;
  exitEasing: EasingType;
}

/** Alias — la card originale utilise CardLayout */
export type CardLayout = InstanceLifecycle;

export interface ElementTransformKf {
  frame: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  easing: EasingType;
}

export interface ComputedElementTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface EyeWaypoint {
  frame: number;
  target: { x: number; y: number; z: number };
  easing: EasingType;
}

export interface ComputedCamera {
  posX: number; posY: number; posZ: number;
  lookAtX: number; lookAtY: number; lookAtZ: number;
  fov: number;
}

export interface ComputedElement {
  x: number; y: number; z: number;
  opacity: number;
}

export interface ComputedCard {
  opacity: number;
  translateX: number;
}

// ── Visual Keyframes ─────────────────────────────────────────────────────────

export interface VisualKeyframeBloom {
  enabled: boolean;
  color: string;
  strength: number;
  threshold: number;
  radius: number;
}

export interface VisualKeyframeLighting {
  ambientIntensity: number;
  directionalIntensity: number;
  pointIntensity: number;
  exposure: number;
  hdrBoostEnabled: boolean;
  hdrBoostMultiplier: number;
}

export interface VisualKeyframeMaterialGroup {
  emissiveColor: string;
  emissiveIntensity: number;
}

export interface VisualKeyframeMaterial {
  iris: VisualKeyframeMaterialGroup;
  eyeRings: VisualKeyframeMaterialGroup;
  revealRings: VisualKeyframeMaterialGroup;
}

export interface VisualKeyframeNeon {
  flowSpeed: number;
  flowEnabled: boolean;
  globalIntensity: number;
}

export interface VisualKeyframe {
  at: number;
  duration: number;
  enterDuration: number;
  exitDuration: number;
  easing: EasingType;
  label?: string;
  bloom: VisualKeyframeBloom;
  lighting: VisualKeyframeLighting;
  material: VisualKeyframeMaterial;
  scene: { backgroundColor: string };
  neon: VisualKeyframeNeon;
}

export interface ComputedVisualState {
  bloom: VisualKeyframeBloom;
  lighting: VisualKeyframeLighting;
  material: VisualKeyframeMaterial;
  scene: { backgroundColor: string };
  neon: VisualKeyframeNeon;
}

export interface TimelineComputed {
  camera: ComputedCamera | null;
  title: ComputedElement;
  subtitle: ComputedElement;
  card: ComputedCard;
  instanceOpacities: Record<string, number>;
  visual: ComputedVisualState | null;
  elementTransforms: Record<string, ComputedElementTransform | null>;
  eyeTarget: { x: number; y: number; z: number } | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface TimelineContext {
  // Core
  totalFrames: number;
  currentFrame: number;

  // Dwells
  dwells: Dwell[];

  // Camera track
  cameraKeyframes: CameraKeyframe[];
  cameraEnabled: boolean;

  // Text tracks
  titleText: string;
  titleFontSize: number;
  titleColor: string;
  titleEmissiveIntensity: number;
  subtitleText: string;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleEmissiveIntensity: number;
  titleLayout: TextElementLayout;
  subtitleLayout: TextElementLayout;
  textVisible: boolean;

  // Card track
  cardEnabled: boolean;
  cardPosTop: number;
  cardPosLeft: number;
  cardLayout: CardLayout;
  instanceLifecycles: Record<string, InstanceLifecycle>;

  // Visual keyframes track
  visualKeyframes: VisualKeyframe[];
  visualEnabled: boolean;

  // Element transform tracks
  elementTracks: Record<string, ElementTransformKf[]>;

  // Eye waypoints
  eyeWaypoints: EyeWaypoint[];

  // Computed (recomputed on frame/layout/keyframe changes)
  computed: TimelineComputed;
}

// ── Events ────────────────────────────────────────────────────────────────────

export type TimelineEvents =
  // Core
  | { type: 'UPDATE_FRAME'; frame: number }
  | { type: 'SET_TOTAL_FRAMES'; totalFrames: number }
  // Dwells
  | { type: 'ADD_DWELL'; dwell: Dwell }
  | { type: 'DELETE_DWELL'; index: number }
  | { type: 'UPDATE_DWELL'; index: number; dwell: Dwell }
  // Camera
  | { type: 'ADD_KEYFRAME'; keyframe: CameraKeyframe }
  | { type: 'UPDATE_KEYFRAME'; index: number; keyframe: CameraKeyframe }
  | { type: 'DELETE_KEYFRAME'; index: number }
  | { type: 'SET_CAMERA_ENABLED'; enabled: boolean }
  | { type: 'IMPORT_KEYFRAMES'; keyframes: CameraKeyframe[] }
  // Text
  | { type: 'SET_TITLE_TEXT'; text: string }
  | { type: 'SET_SUBTITLE_TEXT'; text: string }
  | { type: 'SET_TITLE_FONT_SIZE'; size: number }
  | { type: 'SET_SUBTITLE_FONT_SIZE'; size: number }
  | { type: 'SET_TITLE_COLOR'; color: string }
  | { type: 'SET_SUBTITLE_COLOR'; color: string }
  | { type: 'SET_TITLE_EMISSIVE'; intensity: number }
  | { type: 'SET_SUBTITLE_EMISSIVE'; intensity: number }
  | { type: 'SET_TITLE_LAYOUT'; layout: Partial<TextElementLayout> }
  | { type: 'SET_SUBTITLE_LAYOUT'; layout: Partial<TextElementLayout> }
  | { type: 'IMPORT_LAYOUT'; titleLayout: TextElementLayout; subtitleLayout: TextElementLayout }
  | { type: 'SET_TEXT_VISIBLE'; visible: boolean }
  // Card
  | { type: 'SET_CARD_ENABLED'; enabled: boolean }
  | { type: 'SET_CARD_POS_TOP'; value: number }
  | { type: 'SET_CARD_POS_LEFT'; value: number }
  | { type: 'SET_CARD_LAYOUT'; layout: Partial<CardLayout> }
  // Instance lifecycles
  | { type: 'ADD_INSTANCE_LIFECYCLE'; id: string; lifecycle: InstanceLifecycle }
  | { type: 'SET_INSTANCE_LIFECYCLE'; id: string; lifecycle: Partial<InstanceLifecycle> }
  | { type: 'DELETE_INSTANCE_LIFECYCLE'; id: string }
  // Visual keyframes
  | { type: 'ADD_VISUAL_KF'; keyframe: VisualKeyframe }
  | { type: 'UPDATE_VISUAL_KF'; index: number; keyframe: VisualKeyframe }
  | { type: 'DELETE_VISUAL_KF'; index: number }
  | { type: 'IMPORT_VISUAL_KFS'; keyframes: VisualKeyframe[] }
  | { type: 'SET_VISUAL_ENABLED'; enabled: boolean }
  // Element transform tracks
  | { type: 'ADD_ELEMENT_KF'; elementId: string; keyframe: ElementTransformKf }
  | { type: 'UPDATE_ELEMENT_KF'; elementId: string; index: number; keyframe: ElementTransformKf }
  | { type: 'DELETE_ELEMENT_KF'; elementId: string; index: number }
  | { type: 'DELETE_ELEMENT_TRACK'; elementId: string }
  | { type: 'IMPORT_ELEMENT_TRACKS'; tracks: Record<string, ElementTransformKf[]> }
  // Eye waypoints
  | { type: 'ADD_EYE_WP'; waypoint: EyeWaypoint }
  | { type: 'UPDATE_EYE_WP'; index: number; waypoint: EyeWaypoint }
  | { type: 'DELETE_EYE_WP'; index: number }
  | { type: 'IMPORT_EYE_WPS'; waypoints: EyeWaypoint[] }
  // Global
  | { type: 'IMPORT_TIMELINE'; data: TimelineExport }
  | { type: 'RESTORE_DEFAULTS' }
  | { type: 'RESTORE_CONTEXT'; context: Omit<TimelineContext, 'computed'> };

// ── Import/Export shape ───────────────────────────────────────────────────────

export interface TimelineExport {
  totalFrames: number;
  dwells: Dwell[];
  cameraKeyframes: CameraKeyframe[];
  titleLayout: TextElementLayout;
  subtitleLayout: TextElementLayout;
  cardLayout?: CardLayout;
  instanceLifecycles?: Record<string, InstanceLifecycle>;
  // Rétrocompatibilité lecture (anciens formats)
  cardLayouts?: Record<string, CardLayout>;
  cardScrollStart?: number;
  cardScrollEnd?: number;
  visualKeyframes?: VisualKeyframe[];
  elementTracks?: Record<string, ElementTransformKf[]>;
  eyeWaypoints?: EyeWaypoint[];
}
