import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { scrollCardMachine } from '../machines/scrollCardMachine.ts';

export function useScrollCard(actorRef: ActorRefFrom<typeof scrollCardMachine>) {
  const enabled = useSelector(actorRef, (state) => state.context.enabled);
  const posTop = useSelector(actorRef, (state) => state.context.posTop);
  const posLeft = useSelector(actorRef, (state) => state.context.posLeft);
  const scrollProgress = useSelector(actorRef, (state) => state.context.scrollProgress);

  const setEnabled = (v: boolean) => { actorRef.send({ type: 'SET_ENABLED', enabled: v }); };
  const setPosTop = (v: number) => { actorRef.send({ type: 'SET_POS_TOP', value: v }); };
  const setPosLeft = (v: number) => { actorRef.send({ type: 'SET_POS_LEFT', value: v }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    enabled, posTop, posLeft, scrollProgress,
    setEnabled, setPosTop, setPosLeft, restoreDefaults,
  };
}
