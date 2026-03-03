import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { interactionModeMachine, EditTargetType } from '../machines/interactionModeMachine.ts';

type ModeActorRef = ActorRefFrom<typeof interactionModeMachine>;

export function useInteractionMode(actorRef: ModeActorRef | null | undefined) {
  const mode = useSelector(actorRef ?? undefined, (s) => s?.context.mode ?? 'object');
  const editTargetType = useSelector(actorRef ?? undefined, (s) => s?.context.editTargetType ?? null);
  const editTargetId = useSelector(actorRef ?? undefined, (s) => s?.context.editTargetId ?? null);

  const enterObjectMode = () => actorRef?.send({ type: 'ENTER_OBJECT_MODE' });
  const enterEditMode = (targetType: EditTargetType, targetId?: string) =>
    actorRef?.send({ type: 'ENTER_EDIT_MODE', targetType, targetId });
  const toggleObjectEdit = () => actorRef?.send({ type: 'TOGGLE_OBJECT_EDIT' });
  const enterPreviewMode = () => actorRef?.send({ type: 'ENTER_PREVIEW_MODE' });
  const setEditTarget = (targetType: EditTargetType, targetId?: string) =>
    actorRef?.send({ type: 'SET_EDIT_TARGET', targetType, targetId });

  return {
    mode,
    editTargetType,
    editTargetId,
    enterObjectMode,
    enterEditMode,
    toggleObjectEdit,
    enterPreviewMode,
    setEditTarget,
  };
}
