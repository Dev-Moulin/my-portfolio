import { useRef, useEffect } from 'react';
import type { useTimeline } from '../../hooks/useTimeline.ts';
import type { useOvermind } from '../../hooks/useOvermind.ts';
import type { CameraKeyframe } from '../../machines/timelineMachine.ts';
import { computeCameraState } from '../../machines/timelineMachine.ts';

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
  hoveredEyeWpIdx: number | null;
  setHoveredEyeWpIdx: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useKeyboardShortcuts({
  timeline, camKf, selectionActor,
  hoveredKfAt, setHoveredKfAt,
  hoveredDwellIdx, setHoveredDwellIdx,
  hoveredElementKf, setHoveredElementKf,
  hoveredEyeWpIdx, setHoveredEyeWpIdx,
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
  const hoveredEyeWpIdxRef = useRef(hoveredEyeWpIdx);
  hoveredEyeWpIdxRef.current = hoveredEyeWpIdx;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
        } else if (hoveredEyeWpIdxRef.current !== null) {
          e.preventDefault();
          timelineRef.current.deleteEyeWp(hoveredEyeWpIdxRef.current);
          setHoveredEyeWpIdx(null);
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

      // V = capture visual keyframe (handled by DevControlPanel keydown listener)
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hoveredKfAt, hoveredDwellIdx, setHoveredKfAt, setHoveredDwellIdx, setHoveredElementKf, setHoveredEyeWpIdx]);
}
