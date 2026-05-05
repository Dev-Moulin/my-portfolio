// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  EasingType,
  Dwell, CameraKeyframe, TextElementLayout, CardLayout, InstanceLifecycle,
  ElementTransformKf, ComputedElementTransform, HandleType, EyePathPoint, EyePath,
  ComputedCamera, ComputedElement, ComputedCard,
  VisualKeyframeBloom, VisualKeyframeLighting,
  VisualKeyframeMaterialGroup, VisualKeyframeMaterial,
  VisualKeyframe,
  ComputedVisualState, TimelineComputed,
  FollowPathAssignment, ComputedFollowPathState,
  TimelineContext, TimelineEvents, TimelineExport,
} from './types.ts';

// ── Constants + pure functions ────────────────────────────────────────────────
export {
  DEFAULT_TOTAL_FRAMES, SCROLL_TEXT_OFFSET_X, SCROLL_TEXT_EXIT_Z_OFFSET,
  computeElementState, computeCameraState, computeCardState,
  computeVisualState, computeLifecycleOpacity, remapFrames, getTotalRawFrames,
  computeElementTrackTransform,
  autoComputeHandles, ensureHandles, enforceAlignedConstraint,
  cubicBezierPoint, subdivideBezierSegment,
  cubicBezierTangent, evaluateCurveWithTangent, computeFollowPathStates,
} from './compute.ts';

// ── Defaults ──────────────────────────────────────────────────────────────────
export { DEFAULT_INSTANCE_LIFECYCLE } from './defaults.ts';

// ── Machine ───────────────────────────────────────────────────────────────────
export { timelineMachine } from './machine.ts';
