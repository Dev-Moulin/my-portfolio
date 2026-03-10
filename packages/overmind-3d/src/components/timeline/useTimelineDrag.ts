import { useState, useRef, useEffect } from 'react';
import type { useTimeline } from '../../hooks/useTimeline.ts';
import type { CameraKeyframe, TextElementLayout } from '../../machines/timelineMachine.ts';
import type { DragState, TrackId, DiamondRef, SnapGuide } from './types.ts';
import { edgeToField, TRACK_HEIGHT, SNAP_THRESHOLD_PX } from './constants.ts';

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
  selectedDiamondsRef: React.RefObject<DiamondRef[]>;
  setSelectedDiamonds: React.Dispatch<React.SetStateAction<DiamondRef[]>>;
}

export function useTimelineDrag({
  getProgressFromX, trackAreaRef, timeline, scrollText, camKf, trackOrder, setTrackOrder,
  selectedDiamondsRef, setSelectedDiamonds,
}: UseTimelineDragParams) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [snapGuide, setSnapGuide] = useState<SnapGuide | null>(null);
  const setSnapGuideRef = useRef(setSnapGuide);
  setSnapGuideRef.current = setSnapGuide;

  // Refs for stable closure access
  const kfDragAtRef = useRef(0);
  const dwellDragIdxRef = useRef(0);
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
      : drag.kind === 'clip-slide' || drag.kind === 'visual-slide' || drag.kind === 'diamond-grab' ? 'move'
      : 'ew-resize';
    document.body.style.cursor = cursor;
    return () => { document.body.style.cursor = ''; };
  }, [drag]);

  // ── Main drag handler ──────────────────────────────────────────────────

  useEffect(() => {
    if (!drag || drag.kind === 'track-reorder') return;

    const onMove = (e: MouseEvent) => {
      let p = getProgressFromX(e.clientX);

      // ── Snap-to-neighbors (Ctrl held, diamond drags only) ───────────────
      const isDiamondDrag = drag.kind === 'keyframe' || drag.kind === 'element-keyframe'
        || drag.kind === 'eye-path-point' || drag.kind === 'dwell' || drag.kind === 'diamond-grab';

      if (isDiamondDrag && e.ctrlKey) {
        const allFrames = collectAllKeyframeFrames(timelineRef.current, camKfRef.current);
        if (allFrames.length > 0) {
          const snapThreshold = Math.abs(getProgressFromX(e.clientX + SNAP_THRESHOLD_PX) - p);
          const nearest = allFrames.reduce((best, f) =>
            Math.abs(f - p) < Math.abs(best - p) ? f : best, allFrames[0]);
          if (Math.abs(nearest - p) <= snapThreshold) {
            p = nearest;
            setSnapGuideRef.current({ frame: nearest });
          } else {
            setSnapGuideRef.current(null);
          }
        }
      } else {
        setSnapGuideRef.current(null);
      }

      // ── Handlers per drag type ──────────────────────────────────────────

      if (drag.kind === 'clip-edge') {
        const rp = Math.round(p);
        const st = scrollTextRef.current;
        const field = edgeToField(drag.edge);
        if (drag.trackId === 'title') st.setTitleLayout({ [field]: rp });
        else if (drag.trackId === 'subtitle') st.setSubtitleLayout({ [field]: rp });
        else if (drag.trackId === 'card') timelineRef.current.setCardLayout({ [field]: rp });
        else if (drag.trackId.startsWith('el:')) {
          const ciId = drag.trackId.slice(3);
          timelineRef.current.setInstanceLifecycle(ciId, { [field]: rp });
        }
      } else if (drag.kind === 'clip-slide') {
        const st = scrollTextRef.current;
        const delta = Math.round(p - drag.grabOffset - drag.original.scrollStart);
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
        const rp = Math.round(p);
        const ck = camKfRef.current;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < ck.keyframes.length; i++) {
          const dist = Math.abs(ck.keyframes[i].at - kfDragAtRef.current);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        const kf = ck.keyframes[bestIdx];
        if (kf) {
          ck.updateKeyframe(bestIdx, { ...kf, at: rp });
          kfDragAtRef.current = rp;
        }
      } else if (drag.kind === 'dwell') {
        const tl = timelineRef.current;
        const idx = dwellDragIdxRef.current;
        const dwell = tl.dwells[idx];
        if (dwell) {
          tl.updateDwell(idx, { ...dwell, at: Math.round(p) });
        }
      } else if (drag.kind === 'visual-edge') {
        const rp = Math.round(p);
        const tl = timelineRef.current;
        const vkf = tl.visualKeyframes[drag.index];
        if (!vkf) return;
        const clipEnd = vkf.at + vkf.duration;
        switch (drag.edge) {
          case 'start': {
            const newAt = Math.min(rp, clipEnd - 1);
            tl.updateVisualKeyframe(drag.index, { ...vkf, at: newAt, duration: clipEnd - newAt });
            break;
          }
          case 'enterEnd':
            tl.updateVisualKeyframe(drag.index, { ...vkf, enterDuration: Math.max(0, rp - vkf.at) });
            break;
          case 'exitStart':
            tl.updateVisualKeyframe(drag.index, { ...vkf, exitDuration: Math.max(0, clipEnd - rp) });
            break;
          case 'end':
            tl.updateVisualKeyframe(drag.index, { ...vkf, duration: Math.max(1, rp - vkf.at) });
            break;
        }
      } else if (drag.kind === 'visual-slide') {
        const tl = timelineRef.current;
        const vkf = tl.visualKeyframes[drag.index];
        if (!vkf) return;
        const newAt = Math.round(p - drag.grabOffset);
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
      } else if (drag.kind === 'eye-path-point') {
        const tl = timelineRef.current;
        const pts = tl.eyePath.points;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const dist = Math.abs(pts[i].frame - kfDragAtRef.current);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        const pt = pts[bestIdx];
        if (pt) {
          const newFrame = Math.round(Math.max(0, Math.min(p, tl.totalFrames)));
          tl.updateEyePathPt(bestIdx, { ...pt, frame: newFrame });
          kfDragAtRef.current = newFrame;
        }
      } else if (drag.kind === 'diamond-grab') {
        const delta = Math.round(p - kfDragAtRef.current);
        if (delta === 0) return;

        const sel = selectedDiamondsRef.current;
        if (!sel || sel.length === 0) return;
        const tl = timelineRef.current;
        const ck = camKfRef.current;
        const newSelected: DiamondRef[] = [];

        for (const d of sel) {
          const origKey = `${d.track}:${d.elementId ?? ''}:${d.frame}`;
          const origFrame = drag.initialFrames.get(origKey) ?? d.frame;
          const newFrame = Math.round(Math.max(0, origFrame + delta));

          if (d.track === 'camera') {
            const idx = ck.keyframes.findIndex(kf => Math.round(kf.at) === Math.round(d.frame));
            if (idx !== -1) ck.updateKeyframe(idx, { ...ck.keyframes[idx], at: newFrame });
          } else if (d.track === 'element' && d.elementId) {
            const track = tl.elementTracks[d.elementId];
            const idx = track?.findIndex(kf => Math.round(kf.frame) === Math.round(d.frame));
            if (idx !== undefined && idx !== -1 && track) tl.updateElementKf(d.elementId, idx, { ...track[idx], frame: newFrame });
          } else if (d.track === 'eye-path') {
            const pts = tl.eyePath.points;
            const idx = pts.findIndex(pt => Math.round(pt.frame) === Math.round(d.frame));
            if (idx !== -1) tl.updateEyePathPt(idx, { ...pts[idx], frame: newFrame });
          } else if (d.track === 'dwell') {
            const idx = tl.dwells.findIndex(dw => dw.at === d.frame);
            if (idx !== -1) tl.updateDwell(idx, { ...tl.dwells[idx], at: newFrame });
          }

          newSelected.push({ ...d, frame: newFrame });
        }

        setSelectedDiamonds(newSelected);
      }
    };

    // Escape during diamond-grab → restore initial frames
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.kind === 'diamond-grab') {
        e.preventDefault();
        const sel = selectedDiamondsRef.current;
        if (!sel) { setDrag(null); return; }
        const tl = timelineRef.current;
        const ck = camKfRef.current;
        const restored: DiamondRef[] = [];

        for (const d of sel) {
          const origKey = `${d.track}:${d.elementId ?? ''}:${d.frame}`;
          const origFrame = drag.initialFrames.get(origKey);
          if (origFrame === undefined || origFrame === d.frame) {
            restored.push(d);
            continue;
          }

          if (d.track === 'camera') {
            const idx = ck.keyframes.findIndex(kf => Math.round(kf.at) === Math.round(d.frame));
            if (idx !== -1) ck.updateKeyframe(idx, { ...ck.keyframes[idx], at: origFrame });
          } else if (d.track === 'element' && d.elementId) {
            const track = tl.elementTracks[d.elementId];
            const idx = track?.findIndex(kf => Math.round(kf.frame) === Math.round(d.frame));
            if (idx !== undefined && idx !== -1 && track) tl.updateElementKf(d.elementId, idx, { ...track[idx], frame: origFrame });
          } else if (d.track === 'eye-path') {
            const pts = tl.eyePath.points;
            const idx = pts.findIndex(pt => Math.round(pt.frame) === Math.round(d.frame));
            if (idx !== -1) tl.updateEyePathPt(idx, { ...pts[idx], frame: origFrame });
          } else if (d.track === 'dwell') {
            const idx = tl.dwells.findIndex(dw => dw.at === d.frame);
            if (idx !== -1) tl.updateDwell(idx, { ...tl.dwells[idx], at: origFrame });
          }

          restored.push({ ...d, frame: origFrame });
        }

        setSelectedDiamonds(restored);
        setDrag(null);
      }
    };

    const onUp = () => { setDrag(null); setSnapGuideRef.current(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKeyDown);
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

  return { drag, setDrag, dropIndex, kfDragAtRef, dwellDragIdxRef, snapGuide };
}

// ── Helper: collect all keyframe frames for snap-to-neighbor ─────────────

function collectAllKeyframeFrames(
  timeline: ReturnType<typeof useTimeline>,
  camKf: { keyframes: CameraKeyframe[] },
): number[] {
  const frames: number[] = [];
  for (const kf of camKf.keyframes) frames.push(kf.at);
  for (const [, elKfs] of Object.entries(timeline.elementTracks)) {
    if (elKfs) for (const kf of elKfs) frames.push(kf.frame);
  }
  for (const d of timeline.dwells) frames.push(d.at);
  for (const pt of timeline.eyePath.points) frames.push(pt.frame);
  return [...new Set(frames)];
}
