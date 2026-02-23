import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { materialMachine, MaterialGroup } from '../machines/materialMachine.ts';

export function useMaterial(actorRef: ActorRefFrom<typeof materialMachine>) {
  const irisEmissiveColor = useSelector(actorRef, (state) => state.context.groups.iris.emissiveColor);
  const irisEmissiveIntensity = useSelector(actorRef, (state) => state.context.groups.iris.emissiveIntensity);
  const irisVisible = useSelector(actorRef, (state) => state.context.groups.iris.visible);
  const eyeRingsEmissiveColor = useSelector(actorRef, (state) => state.context.groups.eyeRings.emissiveColor);
  const eyeRingsEmissiveIntensity = useSelector(actorRef, (state) => state.context.groups.eyeRings.emissiveIntensity);
  const eyeRingsVisible = useSelector(actorRef, (state) => state.context.groups.eyeRings.visible);
  const revealRingsEmissiveColor = useSelector(actorRef, (state) => state.context.groups.revealRings.emissiveColor);
  const revealRingsEmissiveIntensity = useSelector(actorRef, (state) => state.context.groups.revealRings.emissiveIntensity);
  const revealRingsVisible = useSelector(actorRef, (state) => state.context.groups.revealRings.visible);

  const updateGroupEmissiveColor = (group: MaterialGroup, color: string) => {
    actorRef.send({ type: 'UPDATE_GROUP_EMISSIVE_COLOR', group, color });
  };
  const updateGroupEmissiveIntensity = (group: MaterialGroup, intensity: number) => {
    actorRef.send({ type: 'UPDATE_GROUP_EMISSIVE_INTENSITY', group, intensity });
  };
  const setAllGroupsColor = (color: string) => { actorRef.send({ type: 'SET_ALL_GROUPS_COLOR', color }); };
  const toggleRevealVisibility = () => { actorRef.send({ type: 'TOGGLE_REVEAL_VISIBILITY' }); };
  const showReveal = () => { actorRef.send({ type: 'SHOW_REVEAL' }); };
  const hideReveal = () => { actorRef.send({ type: 'HIDE_REVEAL' }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    iris: { emissiveColor: irisEmissiveColor, emissiveIntensity: irisEmissiveIntensity, visible: irisVisible },
    eyeRings: { emissiveColor: eyeRingsEmissiveColor, emissiveIntensity: eyeRingsEmissiveIntensity, visible: eyeRingsVisible },
    revealRings: { emissiveColor: revealRingsEmissiveColor, emissiveIntensity: revealRingsEmissiveIntensity, visible: revealRingsVisible },
    updateGroupEmissiveColor, updateGroupEmissiveIntensity,
    setAllGroupsColor, toggleRevealVisibility, showReveal, hideReveal, restoreDefaults,
  };
}
