import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { selectionMachine } from '../machines/selectionMachine.ts';

export function useSelection(actor: ActorRefFrom<typeof selectionMachine>) {
  const ctx = useSelector(actor, (s) => s.context);

  function select(id: string) {
    actor.send({ type: 'SELECT', id });
  }

  function toggleSelect(id: string) {
    actor.send({ type: 'TOGGLE_SELECT', id });
  }

  function deselect() {
    actor.send({ type: 'DESELECT' });
  }

  function setMode(mode: 'translate' | 'rotate' | 'scale') {
    actor.send({ type: 'SET_MODE', mode });
  }

  function toggleVisibility(id: string) {
    actor.send({ type: 'TOGGLE_VISIBILITY', id });
  }

  function setVisibility(id: string, visible: boolean) {
    actor.send({ type: 'SET_VISIBILITY', id, visible });
  }

  return {
    ...ctx,
    select,
    toggleSelect,
    deselect,
    setMode,
    toggleVisibility,
    setVisibility,
  };
}
