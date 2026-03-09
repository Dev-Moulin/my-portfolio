import type { TextElementLayout, CardLayout, InstanceLifecycle, Dwell, TimelineContext, TimelineComputed, EyePath } from './types.ts';
import {
  DEFAULT_TOTAL_FRAMES, SCROLL_TEXT_OFFSET_X, SCROLL_TEXT_EXIT_Z_OFFSET,
  computeElementState, computeCardState,
} from './compute.ts';

// ── Default values (frame-based, totalFrames = 150) ──────────────────────────

const F = DEFAULT_TOTAL_FRAMES;

export const DEFAULT_TITLE_LAYOUT: TextElementLayout = {
  startX: 2 + SCROLL_TEXT_OFFSET_X, startY: 8.33, startZ: 9.84,
  endX: 2, endY: 8.33, endZ: 9.84,
  scrollStart: 0,
  scrollEnd: Math.round(0.15 * F),        // 23
  easing: 'smoothstep',
  exitX: 2, exitY: 8.33, exitZ: 9.84 + SCROLL_TEXT_EXIT_Z_OFFSET,
  exitStart: Math.round(0.468 * F),       // 70
  exitEnd: Math.round(0.528 * F),         // 79
  exitEasing: 'smoothstep',
};

export const DEFAULT_SUBTITLE_LAYOUT: TextElementLayout = {
  startX: 1.67 + SCROLL_TEXT_OFFSET_X, startY: 6.79, startZ: 12.82,
  endX: 1.67, endY: 6.79, endZ: 12.82,
  scrollStart: Math.round(0.05 * F),      // 8
  scrollEnd: Math.round(0.20 * F),        // 30
  easing: 'smoothstep',
  exitX: 1.67, exitY: 6.79, exitZ: 12.82 + SCROLL_TEXT_EXIT_Z_OFFSET,
  exitStart: Math.round(0.440 * F),       // 66
  exitEnd: Math.round(0.498 * F),         // 75
  exitEasing: 'smoothstep',
};

export const DEFAULT_DWELLS: Dwell[] = [
  { at: Math.round(0.300 * F), duration: Math.round(0.10 * F) },  // at: 45, dur: 15
  { at: Math.round(0.685 * F), duration: Math.round(0.10 * F) },  // at: 103, dur: 15
];

export const DEFAULT_CARD_SCROLL_START = Math.round(0.685 * F);  // 103
export const DEFAULT_CARD_SCROLL_END = Math.round(0.783 * F);    // 117

export const DEFAULT_CARD_LAYOUT: CardLayout = {
  scrollStart: DEFAULT_CARD_SCROLL_START,
  scrollEnd: DEFAULT_CARD_SCROLL_END,
  easing: 'smoothstep',
  exitStart: Math.round(0.90 * F),   // 135
  exitEnd: Math.round(0.97 * F),     // 146
  exitEasing: 'smoothstep',
};

export const DEFAULT_INSTANCE_LIFECYCLE: InstanceLifecycle = { ...DEFAULT_CARD_LAYOUT };

export const DEFAULT_EYE_PATH: EyePath = {
  points: [],
  transitionIn: 10,
  transitionOut: 10,
  enabled: true,
  maxInfluence: 0.8,
};

// ── Initial context ───────────────────────────────────────────────────────────

const INITIAL_COMPUTED: TimelineComputed = {
  camera: null,
  title: computeElementState(DEFAULT_TITLE_LAYOUT, 0),
  subtitle: computeElementState(DEFAULT_SUBTITLE_LAYOUT, 0),
  card: computeCardState(DEFAULT_CARD_LAYOUT, 0),
  instanceOpacities: {},
  visual: null,
  elementTransforms: {},
  eyePathState: null,
  followPathStates: {},
};

export const DEFAULTS: TimelineContext = {
  totalFrames: DEFAULT_TOTAL_FRAMES,
  currentFrame: 0,
  dwells: [...DEFAULT_DWELLS],
  cameraKeyframes: [],
  cameraEnabled: false,
  titleText: 'Paul Moulin',
  titleFontSize: 1.5,
  titleColor: '#ffffff',
  titleEmissiveIntensity: 0.7,
  subtitleText: 'Contributing to the Future of Trust\nWeb3 Full-Stack Developer & 3D Enthusiast\nBuilding Decentralized Experiences',
  subtitleFontSize: 0.41,
  subtitleColor: '#aaaacc',
  subtitleEmissiveIntensity: 1.3,
  titleLayout: { ...DEFAULT_TITLE_LAYOUT },
  subtitleLayout: { ...DEFAULT_SUBTITLE_LAYOUT },
  textVisible: true,
  cardEnabled: false,
  cardPosTop: 26.7,
  cardPosLeft: 83.6,
  cardLayout: { ...DEFAULT_CARD_LAYOUT },
  instanceLifecycles: {},
  visualKeyframes: [],
  visualEnabled: false,
  elementTracks: {},
  eyePath: { ...DEFAULT_EYE_PATH },
  followPathAssignments: [],
  computed: INITIAL_COMPUTED,
};
