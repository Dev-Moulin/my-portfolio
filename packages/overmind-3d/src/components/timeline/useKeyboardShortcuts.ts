import { useRef, useEffect } from 'react';
import type { useTimeline } from '../../hooks/useTimeline.ts';
import type { useOvermind } from '../../hooks/useOvermind.ts';
import type { CameraKeyframe } from '../../machines/timelineMachine.ts';
import { computeCameraState } from '../../machines/timelineMachine.ts';
import type { DragState, DiamondRef } from './types.ts';

interface UseKeyboardShortcutsParams {
  timeline: ReturnType<typeof useTimeline>;
  camKf: {
    keyframes: CameraKeyframe[];
    addKeyframe: (kf: CameraKeyframe) => void;
    deleteKeyframe: (index: number) => void;
  };
  selectionActor: ReturnType<typeof useOvermind>['selectionActor'];
  hoveredKfAt: number | null;
  setHoveredKfAt: React.Dispatch<React.SetStateAction<number | null>>;
  hoveredDwellIdx: number | null;
  setHoveredDwellIdx: React.Dispatch<React.SetStateAction<number | null>>;
  hoveredElementKf: { elementId: string; frame: number } | null;
  setHoveredElementKf: React.Dispatch<React.SetStateAction<{ elementId: string; frame: number } | null>>;
  selectedDiamondsRef: React.RefObject<DiamondRef[]>;
  setSelectedDiamonds: React.Dispatch<React.SetStateAction<DiamondRef[]>>;
  setDrag: React.Dispatch<React.SetStateAction<DragState | null>>;
  kfDragAtRef: React.MutableRefObject<number>;
  onOpenEasingMenu: () => void;
  onResetZoom: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

export function useKeyboardShortcuts({
  timeline, camKf, selectionActor,
  hoveredKfAt, setHoveredKfAt,
  hoveredDwellIdx, setHoveredDwellIdx,
  hoveredElementKf, setHoveredElementKf,
  selectedDiamondsRef, setSelectedDiamonds,
  setDrag, kfDragAtRef,
  onOpenEasingMenu, onResetZoom,
  onCopy, onPaste,
}: UseKeyboardShortcutsParams): void {
  // Refs for stable closure access
  const camKfRef = useRef(camKf);
  camKfRef.current = camKf;
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const selectionActorRef = useRef(selectionActor);
  selectionActorRef.current = selectionActor;
  const hoveredElementKfRef = useRef(hoveredElementKf);
  hoveredElementKfRef.current = hoveredElementKf;
  const setSelectedDiamondsRef = useRef(setSelectedDiamonds);
  setSelectedDiamondsRef.current = setSelectedDiamonds;
  const setDragRef = useRef(setDrag);
  setDragRef.current = setDrag;
  const onOpenEasingMenuRef = useRef(onOpenEasingMenu);
  onOpenEasingMenuRef.current = onOpenEasingMenu;
  const onResetZoomRef = useRef(onResetZoom);
  onResetZoomRef.current = onResetZoom;
  const onCopyRef = useRef(onCopy);
  onCopyRef.current = onCopy;
  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl+C = copy selected diamonds
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const sel = selectedDiamondsRef.current;
        if (sel && sel.length > 0) {
          e.preventDefault();
          onCopyRef.current();
          return;
        }
      }

      // Ctrl+V = paste clipboard at cursor
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        onPasteRef.current();
        return;
      }

      // Home = reset zoom to full range
      if (e.key === 'Home') {
        e.preventDefault();
        onResetZoomRef.current();
        return;
      }

      // T = open easing menu for selected diamonds
      if (e.key === 't' || e.key === 'T') {
        const sel = selectedDiamondsRef.current;
        if (sel && sel.length > 0) {
          const selSnap = selectionActorRef.current?.getSnapshot();
          if (selSnap?.context.selectedId) return; // let viewport handle T
          e.preventDefault();
          onOpenEasingMenuRef.current();
          return;
        }
      }

      // I = insert keyframe — if an object is selected, SceneRenderer handles element KF
      if (e.key === 'i' || e.key === 'I') {
        const selSnap = selectionActorRef.current?.getSnapshot();
        if (selSnap?.context.selectedId) return; // let SceneRenderer handle element KF

        e.preventDefault();
        const ck = camKfRef.current;
        const tl = timelineRef.current;
        const frame = tl.currentFrame;
        const kfs = ck.keyframes;
        if (kfs.length === 0) return;

        const computed = computeCameraState(kfs, frame);
        if (!computed) return;
        const nearest = kfs.reduce((prev: typeof kfs[0], cur: typeof kfs[0]) =>
          Math.abs(cur.at - frame) < Math.abs(prev.at - frame) ? cur : prev
        );
        ck.addKeyframe({
          at: Math.round(frame),
          posX: computed.posX, posY: computed.posY, posZ: computed.posZ,
          lookAtX: computed.lookAtX, lookAtY: computed.lookAtY, lookAtZ: computed.lookAtZ,
          fov: computed.fov,
          easing: nearest.easing,
        });
      }

      // ── Diamond selection shortcuts ─────────────────────────────────────────

      // Delete/X = delete selected diamonds
      if (e.key === 'Delete' || e.key === 'x' || e.key === 'X') {
        const sel = selectedDiamondsRef.current;
        if (sel && sel.length > 0) {
          e.preventDefault();
          const ck = camKfRef.current;
          const tl = timelineRef.current;
          // Delete from highest frame to lowest to avoid index shifts
          const sorted = [...sel].sort((a, b) => b.frame - a.frame);
          for (const d of sorted) {
            if (d.track === 'camera') {
              const idx = ck.keyframes.findIndex(kf => kf.at === d.frame);
              if (idx !== -1) ck.deleteKeyframe(idx);
            } else if (d.track === 'element' && d.elementId) {
              const track = tl.elementTracks[d.elementId];
              const idx = track?.findIndex(kf => Math.round(kf.frame) === Math.round(d.frame));
              if (idx !== undefined && idx !== -1) tl.deleteElementKf(d.elementId, idx);
            } else if (d.track === 'eye-path') {
              const idx = tl.eyePath.points.findIndex(pt => Math.round(pt.frame) === Math.round(d.frame));
              if (idx !== -1) tl.deleteEyePathPt(idx);
            } else if (d.track === 'dwell') {
              const idx = tl.dwells.findIndex(dw => dw.at === d.frame);
              if (idx !== -1) tl.deleteDwell(idx);
            }
          }
          setSelectedDiamondsRef.current([]);
          return;
        }
      }

      // Shift+D = duplicate selected diamonds to current frame
      if ((e.key === 'd' || e.key === 'D') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const sel = selectedDiamondsRef.current;
        if (sel && sel.length > 0) {
          e.preventDefault();
          const ck = camKfRef.current;
          const tl = timelineRef.current;
          const frame = Math.round(tl.currentFrame);
          for (const d of sel) {
            if (d.track === 'camera') {
              const src = ck.keyframes.find(kf => kf.at === d.frame);
              if (src) ck.addKeyframe({ ...src, at: frame });
            } else if (d.track === 'element' && d.elementId) {
              const track = tl.elementTracks[d.elementId];
              const src = track?.find(kf => Math.round(kf.frame) === Math.round(d.frame));
              if (src) tl.addElementKf(d.elementId, { ...src, frame });
            } else if (d.track === 'eye-path') {
              const src = tl.eyePath.points.find(pt => Math.round(pt.frame) === Math.round(d.frame));
              if (src) tl.addEyePathPt({ ...src, frame });
            } else if (d.track === 'dwell') {
              const src = tl.dwells.find(dw => dw.at === d.frame);
              if (src) tl.addDwell({ ...src, at: frame });
            }
          }
          return;
        }
      }

      // G = grab selected diamonds (modal move)
      if (e.key === 'g' || e.key === 'G') {
        const sel = selectedDiamondsRef.current;
        if (sel && sel.length > 0) {
          // Don't interfere with viewport G when a 3D object is selected
          const selSnap = selectionActorRef.current?.getSnapshot();
          if (selSnap?.context.selectedId) return;
          e.preventDefault();
          const initialFrames = new Map<string, number>();
          for (const d of sel) {
            const key = `${d.track}:${d.elementId ?? ''}:${d.frame}`;
            initialFrames.set(key, d.frame);
          }
          kfDragAtRef.current = sel[0].frame;
          setDragRef.current({ kind: 'diamond-grab', initialFrames });
          return;
        }
      }

      // ── Hover-based shortcuts (legacy) ──────────────────────────────────────

      // Ctrl+D = duplicate hovered keyframe to current frame
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
        if (hoveredKfAt !== null) {
          const ck = camKfRef.current;
          const srcKf = ck.keyframes.find((kf: typeof ck.keyframes[0]) => kf.at === hoveredKfAt);
          if (srcKf) {
            e.preventDefault();
            ck.addKeyframe({ ...srcKf, at: Math.round(timelineRef.current.currentFrame) });
          }
        } else {
          const hel = hoveredElementKfRef.current;
          if (hel) {
            const tl = timelineRef.current;
            const track = tl.elementTracks[hel.elementId];
            const srcKf = track?.find(kf => Math.round(kf.frame) === Math.round(hel.frame));
            if (srcKf) {
              e.preventDefault();
              tl.addElementKf(hel.elementId, { ...srcKf, frame: Math.round(tl.currentFrame) });
            }
          }
        }
        return;
      }

      // D = delete hovered keyframe OR hovered dwell OR hovered element keyframe
      if (e.key === 'd' || e.key === 'D') {
        if (hoveredKfAt !== null) {
          const ck = camKfRef.current;
          const idx = ck.keyframes.findIndex((kf: typeof ck.keyframes[0]) => kf.at === hoveredKfAt);
          if (idx !== -1) {
            e.preventDefault();
            ck.deleteKeyframe(idx);
            setHoveredKfAt(null);
          }
        } else if (hoveredDwellIdx !== null) {
          e.preventDefault();
          const tl = timelineRef.current;
          tl.deleteDwell(hoveredDwellIdx);
          setHoveredDwellIdx(null);
        } else {
          const hel = hoveredElementKfRef.current;
          if (hel) {
            const tl = timelineRef.current;
            const track = tl.elementTracks[hel.elementId];
            if (track) {
              const idx = track.findIndex(kf => Math.round(kf.frame) === Math.round(hel.frame));
              if (idx !== -1) {
                e.preventDefault();
                tl.deleteElementKf(hel.elementId, idx);
                setHoveredElementKf(null);
              }
            }
          }
        }
      }

      // W = add dwell at current frame
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        const tl = timelineRef.current;
        tl.addDwell({ at: Math.round(tl.currentFrame), duration: 15 });
      }

      // P = add eye path point at current frame
      if (e.key === 'p' || e.key === 'P') {
        const selSnap = selectionActorRef.current?.getSnapshot();
        if (selSnap?.context.selectedId) return; // let viewport handle
        e.preventDefault();
        const tl = timelineRef.current;
        const pts = tl.eyePath.points;
        const lastPt = pts[pts.length - 1];
        const position = lastPt
          ? { x: lastPt.position.x + 1, y: lastPt.position.y, z: lastPt.position.z }
          : { x: 0, y: 1.5, z: 0 };
        tl.addEyePathPt({
          position,
          frame: Math.round(tl.currentFrame),
          dwellFrames: 0,
          easing: 'smoothstep',
        });
      }

      // V = capture visual keyframe (handled by DevControlPanel keydown listener)
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hoveredKfAt, hoveredDwellIdx, setHoveredKfAt, setHoveredDwellIdx, setHoveredElementKf]);
}
