import { useState, useRef, useEffect } from 'react';
import type { useTimeline } from '../../hooks/useTimeline.ts';
import type { CameraKeyframe, TextElementLayout } from '../../machines/timelineMachine.ts';
import type { DragState, TrackId } from './types.ts';
import { edgeToField, TRACK_HEIGHT } from './constants.ts';

interface UseTimelineDragParams {
  getProgressFromX: (clientX: number) => number;
  trackAreaRef: React.RefObject<HTMLDivElement | null>;
  timeline: ReturnType<typeof useTimeline>;
  scrollText: {
    setTitleLayout: (layout: Partial<TextElementLayout>) => void;
    setSubtitleLayout: (layout: Partial<TextElementLayout>) => void;
  };
  camKf: {
    keyframes: CameraKeyframe[];
    updateKeyframe: (index: number, keyframe: CameraKeyframe) => void;
  };
  trackOrder: TrackId[];
  setTrackOrder: React.Dispatch<React.SetStateAction<TrackId[]>>;
}

export function useTimelineDrag({
  getProgressFromX, trackAreaRef, timeline, scrollText, camKf, trackOrder, setTrackOrder,
}: UseTimelineDragParams) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Refs for stable closure access
  const kfDragAtRef = useRef(0);
  const dwellDragIdxRef = useRef(0);
  const eyeWpDragIdxRef = useRef(0);
  const dropIndexRef = useRef<number | null>(null);
  dropIndexRef.current = dropIndex;
  const trackCountRef = useRef(trackOrder.length);
  trackCountRef.current = trackOrder.length;
  const scrollTextRef = useRef(scrollText);
  scrollTextRef.current = scrollText;
  const camKfRef = useRef(camKf);
  camKfRef.current = camKf;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  // ── Cursor style during drag ────────────────────────────────────────────

  useEffect(() => {
    if (!drag) return;
    const cursor = drag.kind === 'track-reorder' ? 'grabbing'
      : drag.kind === 'clip-slide' || drag.kind === 'visual-slide' ? 'move'
      : 'ew-resize';
    document.body.style.cursor = cursor;
    return () => { document.body.style.cursor = ''; };
  }, [drag]);

  // ── Main drag handler ──────────────────────────────────────────────────

  useEffect(() => {
    if (!drag || drag.kind === 'track-reorder') return;

    const onMove = (e: MouseEvent) => {
      const p = getProgressFromX(e.clientX);

      if (drag.kind === 'clip-edge') {
        const st = scrollTextRef.current;
        const field = edgeToField(drag.edge);
        if (drag.trackId === 'title') st.setTitleLayout({ [field]: p });
        else if (drag.trackId === 'subtitle') st.setSubtitleLayout({ [field]: p });
        else if (drag.trackId === 'card') timelineRef.current.setCardLayout({ [field]: p });
        else if (drag.trackId.startsWith('el:')) {
          const ciId = drag.trackId.slice(3);
          timelineRef.current.setInstanceLifecycle(ciId, { [field]: p });
        }
      } else if (drag.kind === 'clip-slide') {
        const st = scrollTextRef.current;
        const delta = p - drag.grabOffset - drag.original.scrollStart;
        const shifted = {
          scrollStart: drag.original.scrollStart + delta,
          scrollEnd: drag.original.scrollEnd + delta,
          exitStart: drag.original.exitStart + delta,
          exitEnd: drag.original.exitEnd + delta,
        };
        if (drag.trackId === 'title') st.setTitleLayout(shifted);
        else if (drag.trackId === 'subtitle') st.setSubtitleLayout(shifted);
        else if (drag.trackId === 'card') timelineRef.current.setCardLayout(shifted);
        else if (drag.trackId.startsWith('el:')) {
          const ciId = drag.trackId.slice(3);
          timelineRef.current.setInstanceLifecycle(ciId, shifted);
        }
      } else if (drag.kind === 'keyframe') {
        const ck = camKfRef.current;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < ck.keyframes.length; i++) {
          const dist = Math.abs(ck.keyframes[i].at - kfDragAtRef.current);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        const kf = ck.keyframes[bestIdx];
        if (kf) {
          ck.updateKeyframe(bestIdx, { ...kf, at: p });
          kfDragAtRef.current = p;
        }
      } else if (drag.kind === 'dwell') {
        const tl = timelineRef.current;
        const idx = dwellDragIdxRef.current;
        const dwell = tl.dwells[idx];
        if (dwell) {
          tl.updateDwell(idx, { ...dwell, at: Math.round(p) });
        }
      } else if (drag.kind === 'visual-edge') {
        const tl = timelineRef.current;
        const vkf = tl.visualKeyframes[drag.index];
        if (!vkf) return;
        const clipEnd = vkf.at + vkf.duration;
        switch (drag.edge) {
          case 'start': {
            const newAt = Math.min(p, clipEnd - 1);
            tl.updateVisualKeyframe(drag.index, { ...vkf, at: newAt, duration: clipEnd - newAt });
            break;
          }
          case 'enterEnd':
            tl.updateVisualKeyframe(drag.index, { ...vkf, enterDuration: Math.max(0, p - vkf.at) });
            break;
          case 'exitStart':
            tl.updateVisualKeyframe(drag.index, { ...vkf, exitDuration: Math.max(0, clipEnd - p) });
            break;
          case 'end':
            tl.updateVisualKeyframe(drag.index, { ...vkf, duration: Math.max(1, p - vkf.at) });
            break;
        }
      } else if (drag.kind === 'visual-slide') {
        const tl = timelineRef.current;
        const vkf = tl.visualKeyframes[drag.index];
        if (!vkf) return;
        const newAt = p - drag.grabOffset + drag.originalAt;
        tl.updateVisualKeyframe(drag.index, { ...vkf, at: Math.max(0, newAt) });
      } else if (drag.kind === 'element-keyframe') {
        const tl = timelineRef.current;
        const track = tl.elementTracks[drag.elementId];
        if (!track) return;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < track.length; i++) {
          const dist = Math.abs(track[i].frame - kfDragAtRef.current);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        const kf = track[bestIdx];
        if (kf) {
          const newFrame = Math.round(Math.max(0, Math.min(p, tl.totalFrames)));
          tl.updateElementKf(drag.elementId, bestIdx, { ...kf, frame: newFrame });
          kfDragAtRef.current = newFrame;
        }
      } else if (drag.kind === 'eye-waypoint') {
        const tl = timelineRef.current;
        const idx = eyeWpDragIdxRef.current;
        const wp = tl.eyeWaypoints[idx];
        if (wp) {
          const newFrame = Math.round(Math.max(0, Math.min(p, tl.totalFrames)));
          tl.updateEyeWp(idx, { ...wp, frame: newFrame });
        }
      }
    };

    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, getProgressFromX]);

  // ── Track reorder drag ────────────────────────────────────────────────

  useEffect(() => {
    if (!drag || drag.kind !== 'track-reorder') return;

    const onMove = (e: MouseEvent) => {
      const el = trackAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top - 18; // 18 = ruler height
      const idx = Math.max(0, Math.min(trackCountRef.current - 1, Math.floor(y / TRACK_HEIGHT)));
      setDropIndex(idx);
    };

    const onUp = () => {
      const di = dropIndexRef.current;
      if (di !== null && drag.kind === 'track-reorder') {
        const dragId = drag.trackId;
        setTrackOrder(prev => {
          const arr = [...prev];
          const from = arr.indexOf(dragId);
          if (from === -1 || from === di) return prev;
          arr.splice(from, 1);
          arr.splice(di, 0, dragId);
          return arr;
        });
      }
      setDrag(null);
      setDropIndex(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, trackAreaRef, setTrackOrder]);

  return { drag, setDrag, dropIndex, kfDragAtRef, dwellDragIdxRef, eyeWpDragIdxRef };
}
