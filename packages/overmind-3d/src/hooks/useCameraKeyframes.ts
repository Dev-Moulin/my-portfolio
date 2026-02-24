import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { cameraKeyframeMachine, CameraKeyframe } from '../machines/cameraKeyframeMachine.ts';

export function useCameraKeyframes(actorRef: ActorRefFrom<typeof cameraKeyframeMachine>) {
  const keyframes = useSelector(actorRef, (state) => state.context.keyframes);
  const scrollProgress = useSelector(actorRef, (state) => state.context.scrollProgress);
  const enabled = useSelector(actorRef, (state) => state.context.enabled);

  const updateScroll = (progress: number) => { actorRef.send({ type: 'UPDATE_SCROLL', progress }); };
  const addKeyframe = (keyframe: CameraKeyframe) => { actorRef.send({ type: 'ADD_KEYFRAME', keyframe }); };
  const updateKeyframe = (index: number, keyframe: CameraKeyframe) => { actorRef.send({ type: 'UPDATE_KEYFRAME', index, keyframe }); };
  const deleteKeyframe = (index: number) => { actorRef.send({ type: 'DELETE_KEYFRAME', index }); };
  const setEnabled = (enabled: boolean) => { actorRef.send({ type: 'SET_ENABLED', enabled }); };
  const importKeyframes = (keyframes: CameraKeyframe[]) => { actorRef.send({ type: 'IMPORT_KEYFRAMES', keyframes }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    keyframes, scrollProgress, enabled,
    updateScroll, addKeyframe, updateKeyframe, deleteKeyframe,
    setEnabled, importKeyframes, restoreDefaults,
  };
}
