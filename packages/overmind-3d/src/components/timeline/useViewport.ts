import { useState, useRef, useCallback, useEffect } from 'react';
import { HEADER_WIDTH } from './constants.ts';
import { DEFAULT_TOTAL_FRAMES } from '../../machines/timelineMachine.ts';

export function useViewport(
  trackAreaRef: React.RefObject<HTMLDivElement | null>,
  totalFrames: number,
) {
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(DEFAULT_TOTAL_FRAMES);

  // Refs for stable closure access
  const viewStartRef = useRef(viewStart);
  viewStartRef.current = viewStart;
  const viewEndRef = useRef(viewEnd);
  viewEndRef.current = viewEnd;
  const totalFramesRef = useRef(totalFrames);
  totalFramesRef.current = totalFrames;

  // ── Frame → CSS % ──────────────────────────────────────────────────────────

  const vp = useCallback((v: number): string => {
    const range = viewEnd - viewStart;
    if (range <= 0) return '0%';
    return `${(((v - viewStart) / range) * 100).toFixed(2)}%`;
  }, [viewStart, viewEnd]);

  // ── ClientX → frame number ────────────────────────────────────────────────

  const getProgressFromX = useCallback((clientX: number): number => {
    const el = trackAreaRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const contentLeft = rect.left + HEADER_WIDTH;
    const contentWidth = rect.width - HEADER_WIDTH;
    if (contentWidth <= 0) return 0;
    const fraction = (clientX - contentLeft) / contentWidth;
    const vs = viewStartRef.current;
    const ve = viewEndRef.current;
    return Math.max(0, Math.min(totalFramesRef.current, vs + fraction * (ve - vs)));
  }, [trackAreaRef]);

  // ── Zoom / pan (Shift+scroll = zoom, scroll = pan) ────────────────────────

  useEffect(() => {
    const el = trackAreaRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const contentLeft = rect.left + HEADER_WIDTH;
      const contentWidth = rect.width - HEADER_WIDTH;
      if (contentWidth <= 0) return;

      const fraction = Math.max(0, Math.min(1, (e.clientX - contentLeft) / contentWidth));
      const vs = viewStartRef.current;
      const ve = viewEndRef.current;
      const range = ve - vs;

      if (e.shiftKey) {
        // Zoom centred on mouse position
        const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
        const mouseProgress = vs + fraction * range;
        const newRange = Math.max(0.01, range * zoomFactor);
        const newStart = mouseProgress - fraction * newRange;
        const newEnd = newStart + newRange;
        setViewStart(Math.max(0, newStart));
        setViewEnd(newEnd);
      } else {
        // Pan horizontal
        const panDelta = (e.deltaY / contentWidth) * range * 0.5;
        const newStart = vs + panDelta;
        const newEnd = ve + panDelta;
        if (newStart >= 0) {
          setViewStart(newStart);
          setViewEnd(newEnd);
        } else {
          setViewStart(0);
          setViewEnd(range);
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [trackAreaRef]);

  return { viewStart, viewEnd, setViewStart, setViewEnd, vp, getProgressFromX };
}
