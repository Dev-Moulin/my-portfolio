import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { bloomMachine } from '../machines/bloomMachine.ts';

export function useBloom(actorRef: ActorRefFrom<typeof bloomMachine>) {
  const enabled = useSelector(actorRef, (state) => state.context.enabled);
  const threshold = useSelector(actorRef, (state) => state.context.threshold);
  const strength = useSelector(actorRef, (state) => state.context.strength);
  const radius = useSelector(actorRef, (state) => state.context.radius);
  const bloomColor = useSelector(actorRef, (state) => state.context.bloomColor);

  const toggleBloom = () => { actorRef.send({ type: 'TOGGLE' }); };
  const enableBloom = () => { actorRef.send({ type: 'ENABLE' }); };
  const disableBloom = () => { actorRef.send({ type: 'DISABLE' }); };
  const updateThreshold = (threshold: number) => { actorRef.send({ type: 'SET_THRESHOLD', threshold }); };
  const updateStrength = (strength: number) => { actorRef.send({ type: 'SET_STRENGTH', strength }); };
  const updateRadius = (radius: number) => { actorRef.send({ type: 'SET_RADIUS', radius }); };
  const setBloomColor = (color: string) => { actorRef.send({ type: 'SET_BLOOM_COLOR', color }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    enabled, threshold, strength, radius, bloomColor,
    toggleBloom, enableBloom, disableBloom,
    updateThreshold, updateStrength, updateRadius,
    setBloomColor, restoreDefaults,
  };
}
