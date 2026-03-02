import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type {
  timelineMachine,
  CameraKeyframe,
  TextElementLayout,
  CardLayout,
  InstanceLifecycle,
  Dwell,
  TimelineExport,
  VisualKeyframe,
  ElementTransformKf,
  EyeWaypoint,
} from '../machines/timelineMachine.ts';

type TimelineActorRef = ActorRefFrom<typeof timelineMachine>;

// ── Full hook ─────────────────────────────────────────────────────────────────

export function useTimeline(actorRef: TimelineActorRef) {
  // Core
  const totalFrames = useSelector(actorRef, (s) => s.context.totalFrames);
  const currentFrame = useSelector(actorRef, (s) => s.context.currentFrame);
  const dwells = useSelector(actorRef, (s) => s.context.dwells);
  const computed = useSelector(actorRef, (s) => s.context.computed);

  // Camera
  const cameraKeyframes = useSelector(actorRef, (s) => s.context.cameraKeyframes);
  const cameraEnabled = useSelector(actorRef, (s) => s.context.cameraEnabled);

  // Text
  const titleText = useSelector(actorRef, (s) => s.context.titleText);
  const subtitleText = useSelector(actorRef, (s) => s.context.subtitleText);
  const titleFontSize = useSelector(actorRef, (s) => s.context.titleFontSize);
  const subtitleFontSize = useSelector(actorRef, (s) => s.context.subtitleFontSize);
  const titleColor = useSelector(actorRef, (s) => s.context.titleColor);
  const subtitleColor = useSelector(actorRef, (s) => s.context.subtitleColor);
  const titleEmissiveIntensity = useSelector(actorRef, (s) => s.context.titleEmissiveIntensity);
  const subtitleEmissiveIntensity = useSelector(actorRef, (s) => s.context.subtitleEmissiveIntensity);
  const titleLayout = useSelector(actorRef, (s) => s.context.titleLayout);
  const subtitleLayout = useSelector(actorRef, (s) => s.context.subtitleLayout);
  const textVisible = useSelector(actorRef, (s) => s.context.textVisible);

  // Card
  const cardEnabled = useSelector(actorRef, (s) => s.context.cardEnabled);
  const cardPosTop = useSelector(actorRef, (s) => s.context.cardPosTop);
  const cardPosLeft = useSelector(actorRef, (s) => s.context.cardPosLeft);
  const cardLayout = useSelector(actorRef, (s) => s.context.cardLayout);
  const instanceLifecycles = useSelector(actorRef, (s) => s.context.instanceLifecycles);

  // Visual keyframes
  const visualKeyframes = useSelector(actorRef, (s) => s.context.visualKeyframes);
  const visualEnabled = useSelector(actorRef, (s) => s.context.visualEnabled);

  // Element transform tracks
  const elementTracks = useSelector(actorRef, (s) => s.context.elementTracks);

  // Eye waypoints
  const eyeWaypoints = useSelector(actorRef, (s) => s.context.eyeWaypoints);

  // ── Actions ─────────────────────────────────────────────────────────────

  // Core
  const updateFrame = (frame: number) => { actorRef.send({ type: 'UPDATE_FRAME', frame }); };
  const setTotalFrames = (totalFrames: number) => { actorRef.send({ type: 'SET_TOTAL_FRAMES', totalFrames }); };

  // Dwells
  const addDwell = (dwell: Dwell) => { actorRef.send({ type: 'ADD_DWELL', dwell }); };
  const deleteDwell = (index: number) => { actorRef.send({ type: 'DELETE_DWELL', index }); };
  const updateDwell = (index: number, dwell: Dwell) => { actorRef.send({ type: 'UPDATE_DWELL', index, dwell }); };

  // Camera
  const addKeyframe = (keyframe: CameraKeyframe) => { actorRef.send({ type: 'ADD_KEYFRAME', keyframe }); };
  const updateKeyframe = (index: number, keyframe: CameraKeyframe) => { actorRef.send({ type: 'UPDATE_KEYFRAME', index, keyframe }); };
  const deleteKeyframe = (index: number) => { actorRef.send({ type: 'DELETE_KEYFRAME', index }); };
  const setCameraEnabled = (enabled: boolean) => { actorRef.send({ type: 'SET_CAMERA_ENABLED', enabled }); };
  const importKeyframes = (keyframes: CameraKeyframe[]) => { actorRef.send({ type: 'IMPORT_KEYFRAMES', keyframes }); };

  // Text
  const setTitleText = (text: string) => { actorRef.send({ type: 'SET_TITLE_TEXT', text }); };
  const setSubtitleText = (text: string) => { actorRef.send({ type: 'SET_SUBTITLE_TEXT', text }); };
  const setTitleFontSize = (size: number) => { actorRef.send({ type: 'SET_TITLE_FONT_SIZE', size }); };
  const setSubtitleFontSize = (size: number) => { actorRef.send({ type: 'SET_SUBTITLE_FONT_SIZE', size }); };
  const setTitleColor = (color: string) => { actorRef.send({ type: 'SET_TITLE_COLOR', color }); };
  const setSubtitleColor = (color: string) => { actorRef.send({ type: 'SET_SUBTITLE_COLOR', color }); };
  const setTitleEmissive = (intensity: number) => { actorRef.send({ type: 'SET_TITLE_EMISSIVE', intensity }); };
  const setSubtitleEmissive = (intensity: number) => { actorRef.send({ type: 'SET_SUBTITLE_EMISSIVE', intensity }); };
  const setTitleLayout = (layout: Partial<TextElementLayout>) => { actorRef.send({ type: 'SET_TITLE_LAYOUT', layout }); };
  const setSubtitleLayout = (layout: Partial<TextElementLayout>) => { actorRef.send({ type: 'SET_SUBTITLE_LAYOUT', layout }); };
  const importLayout = (tl: TextElementLayout, sl: TextElementLayout) => { actorRef.send({ type: 'IMPORT_LAYOUT', titleLayout: tl, subtitleLayout: sl }); };
  const setTextVisible = (visible: boolean) => { actorRef.send({ type: 'SET_TEXT_VISIBLE', visible }); };

  // Card
  const setCardEnabled = (enabled: boolean) => { actorRef.send({ type: 'SET_CARD_ENABLED', enabled }); };
  const setCardPosTop = (value: number) => { actorRef.send({ type: 'SET_CARD_POS_TOP', value }); };
  const setCardPosLeft = (value: number) => { actorRef.send({ type: 'SET_CARD_POS_LEFT', value }); };
  const setCardLayout = (layout: Partial<CardLayout>) => { actorRef.send({ type: 'SET_CARD_LAYOUT', layout }); };
  const addInstanceLifecycle = (id: string, lifecycle: InstanceLifecycle) => { actorRef.send({ type: 'ADD_INSTANCE_LIFECYCLE', id, lifecycle }); };
  const setInstanceLifecycle = (id: string, lifecycle: Partial<InstanceLifecycle>) => { actorRef.send({ type: 'SET_INSTANCE_LIFECYCLE', id, lifecycle }); };
  const deleteInstanceLifecycle = (id: string) => { actorRef.send({ type: 'DELETE_INSTANCE_LIFECYCLE', id }); };

  // Visual keyframes
  const addVisualKeyframe = (keyframe: VisualKeyframe) => { actorRef.send({ type: 'ADD_VISUAL_KF', keyframe }); };
  const updateVisualKeyframe = (index: number, keyframe: VisualKeyframe) => { actorRef.send({ type: 'UPDATE_VISUAL_KF', index, keyframe }); };
  const deleteVisualKeyframe = (index: number) => { actorRef.send({ type: 'DELETE_VISUAL_KF', index }); };
  const importVisualKeyframes = (keyframes: VisualKeyframe[]) => { actorRef.send({ type: 'IMPORT_VISUAL_KFS', keyframes }); };
  const setVisualEnabled = (enabled: boolean) => { actorRef.send({ type: 'SET_VISUAL_ENABLED', enabled }); };

  // Element transform tracks
  const addElementKf = (elementId: string, keyframe: ElementTransformKf) => { actorRef.send({ type: 'ADD_ELEMENT_KF', elementId, keyframe }); };
  const updateElementKf = (elementId: string, index: number, keyframe: ElementTransformKf) => { actorRef.send({ type: 'UPDATE_ELEMENT_KF', elementId, index, keyframe }); };
  const deleteElementKf = (elementId: string, index: number) => { actorRef.send({ type: 'DELETE_ELEMENT_KF', elementId, index }); };
  const importElementTracks = (tracks: Record<string, ElementTransformKf[]>) => { actorRef.send({ type: 'IMPORT_ELEMENT_TRACKS', tracks }); };

  // Eye waypoints
  const addEyeWp = (waypoint: EyeWaypoint) => { actorRef.send({ type: 'ADD_EYE_WP', waypoint }); };
  const updateEyeWp = (index: number, waypoint: EyeWaypoint) => { actorRef.send({ type: 'UPDATE_EYE_WP', index, waypoint }); };
  const deleteEyeWp = (index: number) => { actorRef.send({ type: 'DELETE_EYE_WP', index }); };
  const importEyeWaypoints = (waypoints: EyeWaypoint[]) => { actorRef.send({ type: 'IMPORT_EYE_WPS', waypoints }); };

  // Global
  const exportTimeline = (): TimelineExport => ({
    totalFrames,
    dwells,
    cameraKeyframes,
    titleLayout,
    subtitleLayout,
    cardLayout,
    instanceLifecycles,
    visualKeyframes,
    elementTracks,
    eyeWaypoints,
  });
  const importTimeline = (data: TimelineExport) => { actorRef.send({ type: 'IMPORT_TIMELINE', data }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    // State
    totalFrames, currentFrame, dwells, computed,
    cameraKeyframes, cameraEnabled,
    titleText, subtitleText, titleFontSize, subtitleFontSize,
    titleColor, subtitleColor, titleEmissiveIntensity, subtitleEmissiveIntensity,
    titleLayout, subtitleLayout, textVisible,
    cardEnabled, cardPosTop, cardPosLeft, cardLayout, instanceLifecycles,
    visualKeyframes, visualEnabled,
    elementTracks,
    eyeWaypoints,

    // Actions
    updateFrame, setTotalFrames,
    addDwell, deleteDwell, updateDwell,
    addKeyframe, updateKeyframe, deleteKeyframe, setCameraEnabled, importKeyframes,
    setTitleText, setSubtitleText, setTitleFontSize, setSubtitleFontSize,
    setTitleColor, setSubtitleColor, setTitleEmissive, setSubtitleEmissive,
    setTitleLayout, setSubtitleLayout, importLayout, setTextVisible,
    setCardEnabled, setCardPosTop, setCardPosLeft, setCardLayout, addInstanceLifecycle, setInstanceLifecycle, deleteInstanceLifecycle,
    addVisualKeyframe, updateVisualKeyframe, deleteVisualKeyframe, importVisualKeyframes, setVisualEnabled,
    addElementKf, updateElementKf, deleteElementKf, importElementTracks,
    addEyeWp, updateEyeWp, deleteEyeWp, importEyeWaypoints,
    exportTimeline, importTimeline, restoreDefaults,
  };
}
