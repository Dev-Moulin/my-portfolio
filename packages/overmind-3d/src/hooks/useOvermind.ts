import { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { OvermindContext } from '../context/OvermindContext.ts';

export function useOvermind() {
  const ctx = useContext(OvermindContext);
  if (!ctx) {
    throw new Error('[useOvermind] Must be used within <OvermindProvider>');
  }

  const { actorRef } = ctx;

  const isRunning = useSelector(actorRef, (state) => state.value === 'running');
  const bloomActor = useSelector(actorRef, (state) => state.context.bloomActor);
  const lightsActor = useSelector(actorRef, (state) => state.context.lightsActor);
  const materialActor = useSelector(actorRef, (state) => state.context.materialActor);
  const modelActor = useSelector(actorRef, (state) => state.context.modelActor);
  const pbrActor = useSelector(actorRef, (state) => state.context.pbrActor);
  const sceneActor = useSelector(actorRef, (state) => state.context.sceneActor);
  const performanceActor = useSelector(actorRef, (state) => state.context.performanceActor);
  const revelationActor = useSelector(actorRef, (state) => state.context.revelationActor);
  // const popActor = useSelector(actorRef, (state) => state.context.popActor);
  const visualPresetActor = useSelector(actorRef, (state) => state.context.visualPresetActor);
  const steeringActor = useSelector(actorRef, (state) => state.context.steeringActor);
  const timelineActor = useSelector(actorRef, (state) => state.context.timelineActor);
  const selectionActor = useSelector(actorRef, (state) => state.context.selectionActor);
  const interactionModeActor = useSelector(actorRef, (state) => state.context.interactionModeActor);

  return {
    actorRef,
    isRunning,
    bloomActor,
    lightsActor,
    materialActor,
    modelActor,
    pbrActor,
    sceneActor,
    performanceActor,
    revelationActor,
    // popActor,
    visualPresetActor,
    steeringActor,
    timelineActor,
    selectionActor,
    interactionModeActor,
  };
}
