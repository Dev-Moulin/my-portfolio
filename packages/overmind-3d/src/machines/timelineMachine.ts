// Barrel — tous les consommateurs gardent ce chemin d'import.
export type {
  EasingType,
  Dwell, CameraKeyframe, TextElementLayout, CardLayout, InstanceLifecycle,
  ElementTransformKf, ComputedElementTransform, EyeWaypoint, EyePathPoint, EyePath,
  ComputedCamera, ComputedElement, ComputedCard,
  VisualKeyframeBloom, VisualKeyframeLighting,
  VisualKeyframeMaterialGroup, VisualKeyframeMaterial,
  VisualKeyframeNeon, VisualKeyframe,
  ComputedVisualState, TimelineComputed,
  TimelineContext, TimelineEvents, TimelineExport,
} from './timeline/index.ts';

export {
  DEFAULT_TOTAL_FRAMES, SCROLL_TEXT_OFFSET_X, SCROLL_TEXT_EXIT_Z_OFFSET,
  computeElementState, computeCameraState, computeCardState,
  computeVisualState, computeLifecycleOpacity, remapFrames, getTotalRawFrames,
  computeElementTrackTransform,
  DEFAULT_INSTANCE_LIFECYCLE,
  timelineMachine,
} from './timeline/index.ts';
