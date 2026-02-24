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
  const lightingActor = useSelector(actorRef, (state) => state.context.lightingActor);
  const materialActor = useSelector(actorRef, (state) => state.context.materialActor);
  const modelActor = useSelector(actorRef, (state) => state.context.modelActor);
  const pbrActor = useSelector(actorRef, (state) => state.context.pbrActor);
  const sceneActor = useSelector(actorRef, (state) => state.context.sceneActor);
  const performanceActor = useSelector(actorRef, (state) => state.context.performanceActor);
  const revelationActor = useSelector(actorRef, (state) => state.context.revelationActor);
  const popActor = useSelector(actorRef, (state) => state.context.popActor);
  const visualPresetActor = useSelector(actorRef, (state) => state.context.visualPresetActor);
  const neonBandsActor = useSelector(actorRef, (state) => state.context.neonBandsActor);
  const steeringActor = useSelector(actorRef, (state) => state.context.steeringActor);
  const scrollTextActor = useSelector(actorRef, (state) => state.context.scrollTextActor);
  const cameraKeyframeActor = useSelector(actorRef, (state) => state.context.cameraKeyframeActor);
  const scrollCardActor = useSelector(actorRef, (state) => state.context.scrollCardActor);

  return {
    actorRef,
    isRunning,
    bloomActor,
    lightingActor,
    materialActor,
    modelActor,
    pbrActor,
    sceneActor,
    performanceActor,
    revelationActor,
    popActor,
    visualPresetActor,
    neonBandsActor,
    steeringActor,
    scrollTextActor,
    cameraKeyframeActor,
    scrollCardActor,
  };
}
