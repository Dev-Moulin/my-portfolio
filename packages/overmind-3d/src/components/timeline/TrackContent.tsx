import type { useTimeline } from '../../hooks/useTimeline.ts';
import type { CameraKeyframe } from '../../machines/timelineMachine.ts';
import type { DragState, TrackId } from './types.ts';
import { COLORS, getTrackColor, ELEMENT_TRACK_DEFAULT_COLOR } from './constants.ts';
import { resolveDescriptorMeta } from '../../scene/descriptors/index.ts';
import { ClipBar, KeyframeDiamond, KeyframeBar } from './sub-components.tsx';

interface TrackContentProps {
  id: TrackId;
  vp: (v: number) => string;
  timeline: ReturnType<typeof useTimeline>;
  camKfKeyframes: CameraKeyframe[];
  setDrag: React.Dispatch<React.SetStateAction<DragState | null>>;
  kfDragAtRef: React.MutableRefObject<number>;
  eyeWpDragIdxRef: React.MutableRefObject<number>;
  hoveredKfAt: number | null;
  setHoveredKfAt: React.Dispatch<React.SetStateAction<number | null>>;
  hoveredElementKf: { elementId: string; frame: number } | null;
  setHoveredElementKf: React.Dispatch<React.SetStateAction<{ elementId: string; frame: number } | null>>;
  hoveredEyeWpIdx: number | null;
  setHoveredEyeWpIdx: React.Dispatch<React.SetStateAction<number | null>>;
  getProgressFromX: (clientX: number) => number;
  startClipSlide: (trackId: TrackId, e: React.MouseEvent) => void;
}

export function TrackContent({
  id, vp, timeline, camKfKeyframes, setDrag,
  kfDragAtRef, eyeWpDragIdxRef,
  hoveredKfAt, setHoveredKfAt,
  hoveredElementKf, setHoveredElementKf,
  hoveredEyeWpIdx, setHoveredEyeWpIdx,
  getProgressFromX, startClipSlide,
}: TrackContentProps) {
  const tl = timeline.titleLayout;
  const sl = timeline.subtitleLayout;

  switch (id) {
    case 'camera':
      return (
        <>
          {camKfKeyframes.map((kf, i) => {
            if (i >= camKfKeyframes.length - 1) return null;
            return <KeyframeBar key={`bar-${i}`} from={kf.at} to={camKfKeyframes[i + 1].at} color={COLORS.camera} vp={vp} />;
          })}
          {camKfKeyframes.map((kf, i) => (
            <KeyframeDiamond
              key={i}
              at={kf.at}
              color={COLORS.camera}
              hovered={hoveredKfAt === kf.at}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = kf.at;
                setDrag({ kind: 'keyframe' });
              }}
              onHover={(h) => setHoveredKfAt(h ? kf.at : null)}
            />
          ))}
        </>
      );
    case 'eye':
      return (
        <>
          {timeline.eyeWaypoints.map((wp, i) => {
            if (i >= timeline.eyeWaypoints.length - 1) return null;
            return <KeyframeBar key={`bar-${i}`} from={wp.frame} to={timeline.eyeWaypoints[i + 1].frame} color={getTrackColor('eye')} vp={vp} />;
          })}
          {timeline.eyeWaypoints.map((wp, i) => (
            <KeyframeDiamond
              key={i}
              at={wp.frame}
              color={getTrackColor('eye')}
              hovered={hoveredEyeWpIdx === i}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = wp.frame;
                eyeWpDragIdxRef.current = i;
                setDrag({ kind: 'eye-waypoint' });
              }}
              onHover={(h) => setHoveredEyeWpIdx(h ? i : null)}
            />
          ))}
        </>
      );
    case 'title': {
      const titleElKfs = timeline.elementTracks['title'] ?? [];
      return (
        <>
          <ClipBar
            start={tl.scrollStart} end={tl.exitEnd}
            color={COLORS.title} label="Title"
            phases={{ enterEnd: tl.scrollEnd, exitStart: tl.exitStart }}
            resizable vp={vp}
            onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: 'title', edge })}
            onSlideDrag={(e) => startClipSlide('title', e)}
          />
          {titleElKfs.map((kf, i) => {
            if (i >= titleElKfs.length - 1) return null;
            return <KeyframeBar key={`elbar-${i}`} from={kf.frame} to={titleElKfs[i + 1].frame} color={resolveDescriptorMeta('title')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR} vp={vp} />;
          })}
          {titleElKfs.map((kf, i) => (
            <KeyframeDiamond
              key={`el-${i}`}
              at={kf.frame}
              color={resolveDescriptorMeta('title')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR}
              hovered={hoveredElementKf?.elementId === 'title' && hoveredElementKf?.frame === kf.frame}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = kf.frame;
                setDrag({ kind: 'element-keyframe', elementId: 'title' });
              }}
              onHover={(h) => setHoveredElementKf(h ? { elementId: 'title', frame: kf.frame } : null)}
            />
          ))}
        </>
      );
    }
    case 'subtitle': {
      const subtitleElKfs = timeline.elementTracks['subtitle'] ?? [];
      return (
        <>
          <ClipBar
            start={sl.scrollStart} end={sl.exitEnd}
            color={COLORS.subtitle} label="Subtitle"
            phases={{ enterEnd: sl.scrollEnd, exitStart: sl.exitStart }}
            resizable vp={vp}
            onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: 'subtitle', edge })}
            onSlideDrag={(e) => startClipSlide('subtitle', e)}
          />
          {subtitleElKfs.map((kf, i) => {
            if (i >= subtitleElKfs.length - 1) return null;
            return <KeyframeBar key={`elbar-${i}`} from={kf.frame} to={subtitleElKfs[i + 1].frame} color={resolveDescriptorMeta('subtitle')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR} vp={vp} />;
          })}
          {subtitleElKfs.map((kf, i) => (
            <KeyframeDiamond
              key={`el-${i}`}
              at={kf.frame}
              color={resolveDescriptorMeta('subtitle')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR}
              hovered={hoveredElementKf?.elementId === 'subtitle' && hoveredElementKf?.frame === kf.frame}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = kf.frame;
                setDrag({ kind: 'element-keyframe', elementId: 'subtitle' });
              }}
              onHover={(h) => setHoveredElementKf(h ? { elementId: 'subtitle', frame: kf.frame } : null)}
            />
          ))}
        </>
      );
    }
    case 'card': {
      const cl = timeline.cardLayout;
      const cardElKfs = timeline.elementTracks['card'] ?? [];
      return (
        <>
          <ClipBar
            start={cl.scrollStart} end={cl.exitEnd}
            color={COLORS.card} label="Card"
            phases={{ enterEnd: cl.scrollEnd, exitStart: cl.exitStart }}
            resizable vp={vp}
            onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: 'card', edge })}
            onSlideDrag={(e) => startClipSlide('card', e)}
          />
          {cardElKfs.map((kf, i) => {
            if (i >= cardElKfs.length - 1) return null;
            return <KeyframeBar key={`elbar-${i}`} from={kf.frame} to={cardElKfs[i + 1].frame} color={resolveDescriptorMeta('card')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR} vp={vp} />;
          })}
          {cardElKfs.map((kf, i) => (
            <KeyframeDiamond
              key={`el-${i}`}
              at={kf.frame}
              color={resolveDescriptorMeta('card')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR}
              hovered={hoveredElementKf?.elementId === 'card' && hoveredElementKf?.frame === kf.frame}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = kf.frame;
                setDrag({ kind: 'element-keyframe', elementId: 'card' });
              }}
              onHover={(h) => setHoveredElementKf(h ? { elementId: 'card', frame: kf.frame } : null)}
            />
          ))}
        </>
      );
    }
    case 'visual':
      return (
        <>
          {timeline.visualKeyframes.map((vkf, i) => (
            <ClipBar
              key={i}
              start={vkf.at}
              end={vkf.at + vkf.duration}
              color={COLORS.visual}
              label={vkf.label || `V${i + 1}`}
              phases={{
                enterEnd: vkf.at + vkf.enterDuration,
                exitStart: vkf.at + vkf.duration - vkf.exitDuration,
              }}
              resizable
              vp={vp}
              onEdgeDrag={(edge) => setDrag({ kind: 'visual-edge', index: i, edge })}
              onSlideDrag={(e) => {
                const mouseP = getProgressFromX(e.clientX);
                setDrag({
                  kind: 'visual-slide',
                  index: i,
                  grabOffset: mouseP - vkf.at,
                  originalAt: vkf.at,
                });
              }}
            />
          ))}
        </>
      );
    default: {
      if (!id.startsWith('el:')) return null;
      const elId = id.slice(3);
      const elKfs = timeline.elementTracks[elId] ?? [];
      const meta = resolveDescriptorMeta(elId);
      const color = meta?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR;
      const instanceLifecycle = timeline.instanceLifecycles[elId];
      return (
        <>
          {instanceLifecycle && (
            <ClipBar
              start={instanceLifecycle.scrollStart} end={instanceLifecycle.exitEnd}
              color={color} label={meta?.displayName ?? elId}
              phases={{ enterEnd: instanceLifecycle.scrollEnd, exitStart: instanceLifecycle.exitStart }}
              resizable vp={vp}
              onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: id, edge })}
              onSlideDrag={(e) => startClipSlide(id, e)}
            />
          )}
          {elKfs.map((kf, i) => {
            if (i >= elKfs.length - 1) return null;
            return <KeyframeBar key={`bar-${i}`} from={kf.frame} to={elKfs[i + 1].frame} color={color} vp={vp} />;
          })}
          {elKfs.map((kf, i) => (
            <KeyframeDiamond
              key={i}
              at={kf.frame}
              color={color}
              hovered={hoveredElementKf?.elementId === elId && hoveredElementKf?.frame === kf.frame}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = kf.frame;
                setDrag({ kind: 'element-keyframe', elementId: elId });
              }}
              onHover={(h) => setHoveredElementKf(h ? { elementId: elId, frame: kf.frame } : null)}
            />
          ))}
        </>
      );
    }
  }
}
