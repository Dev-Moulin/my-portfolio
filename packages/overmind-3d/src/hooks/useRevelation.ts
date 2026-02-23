import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { Object3D } from 'three';
import type { revelationMachine, TriggerZone, RingInfo } from '../machines/revelationMachine.ts';

export function useRevelation(actorRef: ActorRefFrom<typeof revelationMachine>) {
  const triggerZone = useSelector(actorRef, (state) => state.context.triggerZone);
  const ringInfos = useSelector(actorRef, (state) => state.context.ringInfos);
  const forceShowAll = useSelector(actorRef, (state) => state.context.forceShowAll);
  const isAnimating = useSelector(actorRef, (state) => state.context.isAnimating);
  const showZoneHelper = useSelector(actorRef, (state) => state.context.showZoneHelper);

  const setRings = (rings: Object3D[]) => { actorRef.send({ type: 'SET_RINGS', rings }); };
  const setModelReference = (model: Object3D) => { actorRef.send({ type: 'SET_MODEL_REFERENCE', model }); };
  const updateRevelation = () => { actorRef.send({ type: 'UPDATE_REVELATION' }); };
  const toggleForceShowAll = () => { actorRef.send({ type: 'TOGGLE_FORCE_SHOW_ALL' }); };
  const setForceShowAll = (force: boolean) => { actorRef.send({ type: 'SET_FORCE_SHOW_ALL', force }); };
  const toggleZoneHelper = (visible: boolean) => { actorRef.send({ type: 'TOGGLE_ZONE_HELPER', visible }); };
  const startRingAnimation = () => { actorRef.send({ type: 'START_RING_ANIMATION' }); };
  const moveZone = (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => {
    actorRef.send({ type: 'MOVE_ZONE', direction });
  };
  const scaleZone = (direction: 'increase' | 'decrease') => { actorRef.send({ type: 'SCALE_ZONE', direction }); };
  const updateZonePosition = (position: { x: number; y: number; z: number }) => {
    actorRef.send({ type: 'UPDATE_ZONE_POSITION', position });
  };
  const updateZoneRadius = (radius: number) => { actorRef.send({ type: 'UPDATE_ZONE_RADIUS', radius }); };
  const resetZone = () => { actorRef.send({ type: 'RESET_ZONE' }); };

  return {
    triggerZone, ringInfos, forceShowAll, isAnimating, showZoneHelper,
    setRings, setModelReference, updateRevelation,
    toggleForceShowAll, setForceShowAll, toggleZoneHelper,
    startRingAnimation, moveZone, scaleZone,
    updateZonePosition, updateZoneRadius, resetZone
  };
}

export type { TriggerZone, RingInfo };
