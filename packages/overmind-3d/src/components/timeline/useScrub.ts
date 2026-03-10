import { useState, useCallback, useEffect } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { timelineMachine } from '../../machines/timelineMachine.ts';
import type { DragState } from './types.ts';

export function useScrub(
  getProgressFromX: (clientX: number) => number,
  timelineActor: ActorRefFrom<typeof timelineMachine>,
  drag: DragState | null,
) {
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handleScrub = useCallback((clientX: number) => {
    const frame = getProgressFromX(clientX);
    timelineActor.send({ type: 'UPDATE_FRAME', frame });
  }, [getProgressFromX, timelineActor]);

  const onTrackAreaMouseDown = useCallback((e: React.MouseEvent) => {
    if (drag) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-track-content]')) {
      setIsScrubbing(true);
      handleScrub(e.clientX);
    }
  }, [handleScrub, drag]);

  useEffect(() => {
    if (!isScrubbing) return;
    const onMove = (e: MouseEvent) => handleScrub(e.clientX);
    const onUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isScrubbing, handleScrub]);

  const startScrub = useCallback((e: React.MouseEvent) => {
    handleScrub(e.clientX);
    // Attach listeners immediately (don't rely on React state batching)
    const onMove = (ev: MouseEvent) => handleScrub(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [handleScrub]);

  return { onTrackAreaMouseDown, startScrub };
}
