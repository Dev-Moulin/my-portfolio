import { useState, useRef, useCallback, useEffect } from 'react';
import { HEADER_WIDTH, MIN_ZOOM_RANGE, ZOOM_PADDING } from './constants.ts';
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

  // ── Zoom / pan (scroll = zoom, Shift+scroll = pan) ────────────────────────

  useEffect(() => {
    const el = trackAreaRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      // Mouse over label area → let native vertical scroll happen
      if (e.clientX < rect.left + HEADER_WIDTH) return;
      e.preventDefault();
      const contentLeft = rect.left + HEADER_WIDTH;
      const contentWidth = rect.width - HEADER_WIDTH;
      if (contentWidth <= 0) return;

      const fraction = Math.max(0, Math.min(1, (e.clientX - contentLeft) / contentWidth));
      const vs = viewStartRef.current;
      const ve = viewEndRef.current;
      const range = ve - vs;

      // Trackpad horizontal swipe → pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const panDelta = (e.deltaX / contentWidth) * range * 0.5;
        const newStart = vs + panDelta;
        const newEnd = ve + panDelta;
        if (newStart >= 0) {
          setViewStart(newStart);
          setViewEnd(newEnd);
        } else {
          setViewStart(0);
          setViewEnd(range);
        }
        return;
      }

      if (e.shiftKey) {
        // Shift+scroll = pan horizontal
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
      } else {
        // Scroll = zoom centred on mouse position
        const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
        const mouseProgress = vs + fraction * range;
        const newRange = Math.max(MIN_ZOOM_RANGE, range * zoomFactor);
        const newStart = mouseProgress - fraction * newRange;
        const newEnd = newStart + newRange;
        setViewStart(Math.max(0, newStart));
        setViewEnd(newEnd);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [trackAreaRef]);

  // ── MMB drag pan ───────────────────────────────────────────────────────────

  const panningRef = useRef<{ startX: number; startVS: number; startVE: number } | null>(null);

  useEffect(() => {
    const el = trackAreaRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // only middle mouse button
      e.preventDefault();
      e.stopPropagation();
      panningRef.current = {
        startX: e.clientX,
        startVS: viewStartRef.current,
        startVE: viewEndRef.current,
      };
      document.body.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      const pan = panningRef.current;
      if (!pan) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const contentWidth = rect.width - HEADER_WIDTH;
      if (contentWidth <= 0) return;
      const range = pan.startVE - pan.startVS;
      const deltaFrames = ((e.clientX - pan.startX) / contentWidth) * range;
      const newStart = pan.startVS - deltaFrames;
      if (newStart >= 0) {
        setViewStart(newStart);
        setViewEnd(newStart + range);
      } else {
        setViewStart(0);
        setViewEnd(range);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if (!panningRef.current) return;
      panningRef.current = null;
      document.body.style.cursor = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [trackAreaRef]);

  // ── Zoom to fit / Reset ────────────────────────────────────────────────────

  const zoomToFit = useCallback((minFrame: number, maxFrame: number) => {
    const range = maxFrame - minFrame;
    const pad = Math.max(range * ZOOM_PADDING, 1);
    setViewStart(Math.max(0, minFrame - pad));
    setViewEnd(maxFrame + pad);
  }, []);

  const resetZoom = useCallback(() => {
    setViewStart(0);
    setViewEnd(totalFramesRef.current);
  }, []);

  return { viewStart, viewEnd, setViewStart, setViewEnd, vp, getProgressFromX, zoomToFit, resetZoom };
}
