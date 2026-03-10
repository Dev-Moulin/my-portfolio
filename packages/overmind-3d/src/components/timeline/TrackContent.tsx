import type { useTimeline } from '../../hooks/useTimeline.ts';
import type { CameraKeyframe } from '../../machines/timelineMachine.ts';
import type { DragState, TrackId, DiamondRef } from './types.ts';
import { isDiamondSelected } from './types.ts';
import { COLORS, getTrackColor, ELEMENT_TRACK_DEFAULT_COLOR, SUB_TRACK_H } from './constants.ts';
import { resolveDescriptorMeta } from '../../scene/descriptors/index.ts';
import { ClipBar, KeyframeDiamond, KeyframeBar } from './sub-components.tsx';

interface TrackContentProps {
  id: TrackId;
  vp: (v: number) => string;
  timeline: ReturnType<typeof useTimeline>;
  camKfKeyframes: CameraKeyframe[];
  setDrag: React.Dispatch<React.SetStateAction<DragState | null>>;
  kfDragAtRef: React.MutableRefObject<number>;
  hoveredKfAt: number | null;
  setHoveredKfAt: React.Dispatch<React.SetStateAction<number | null>>;
  hoveredElementKf: { elementId: string; frame: number } | null;
  setHoveredElementKf: React.Dispatch<React.SetStateAction<{ elementId: string; frame: number } | null>>;
  getProgressFromX: (clientX: number) => number;
  startClipSlide: (trackId: TrackId, e: React.MouseEvent) => void;
  selectedDiamonds: DiamondRef[];
  onDiamondSelect: (ref: DiamondRef, shiftKey: boolean) => void;
}

const subRow: React.CSSProperties = {
  position: 'relative', height: `${SUB_TRACK_H}px`, width: '100%',
};

export function TrackContent({
  id, vp, timeline, camKfKeyframes, setDrag,
  kfDragAtRef,
  hoveredKfAt, setHoveredKfAt,
  hoveredElementKf, setHoveredElementKf,
  getProgressFromX, startClipSlide,
  selectedDiamonds, onDiamondSelect,
}: TrackContentProps) {
  const tl = timeline.titleLayout;
  const sl = timeline.subtitleLayout;

  switch (id) {
    case 'camera':
      return (
        <>
          {camKfKeyframes.map((kf, i) => {
            if (i >= camKfKeyframes.length - 1) return null;
            return <KeyframeBar key={`bar-${i}`} from={kf.at} to={camKfKeyframes[i + 1].at} color={COLORS.camera} easingType={camKfKeyframes[i + 1].easing} vp={vp} />;
          })}
          {camKfKeyframes.map((kf, i) => (
            <KeyframeDiamond
              key={i}
              at={kf.at}
              color={COLORS.camera}
              hovered={hoveredKfAt === kf.at}
              isSelected={isDiamondSelected(selectedDiamonds, { track: 'camera', frame: kf.at })}
              easingType={kf.easing}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = kf.at;
                setDrag({ kind: 'keyframe' });
              }}
              onSelect={(shift) => onDiamondSelect({ track: 'camera', frame: kf.at }, shift)}
              onHover={(h) => setHoveredKfAt(h ? kf.at : null)}
            />
          ))}
        </>
      );
    case 'eye-path': {
      const pts = timeline.eyePath.points;
      return (
        <>
          {pts.map((pt, i) => {
            if (i >= pts.length - 1) return null;
            return <KeyframeBar key={`bar-${i}`} from={pt.frame} to={pts[i + 1].frame} color={getTrackColor('eye-path')} easingType={pts[i + 1].easing} vp={vp} />;
          })}
          {pts.map((pt, i) => (
            <KeyframeDiamond
              key={i}
              at={pt.frame}
              color={getTrackColor('eye-path')}
              hovered={false}
              isSelected={isDiamondSelected(selectedDiamonds, { track: 'eye-path', frame: pt.frame })}
              easingType={pt.easing}
              handleType={pt.handleType ?? 'auto'}
              vp={vp}
              onDragStart={() => {
                kfDragAtRef.current = pt.frame;
                setDrag({ kind: 'eye-path-point' });
              }}
              onSelect={(shift) => onDiamondSelect({ track: 'eye-path', frame: pt.frame }, shift)}
              onHover={() => {}}
            />
          ))}
        </>
      );
    }
    case 'title': {
      const titleElKfs = timeline.elementTracks['title'] ?? [];
      return (
        <>
          <div style={subRow}>
            <ClipBar
              start={tl.scrollStart} end={tl.exitEnd}
              color={COLORS.title} label="Title"
              phases={{ enterEnd: tl.scrollEnd, exitStart: tl.exitStart }}
              resizable vp={vp}
              onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: 'title', edge })}
              onSlideDrag={(e) => startClipSlide('title', e)}
            />
          </div>
          <div style={subRow}>
            {titleElKfs.map((kf, i) => {
              if (i >= titleElKfs.length - 1) return null;
              return <KeyframeBar key={`elbar-${i}`} from={kf.frame} to={titleElKfs[i + 1].frame} color={resolveDescriptorMeta('title')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR} easingType={titleElKfs[i + 1].easing} vp={vp} />;
            })}
            {titleElKfs.map((kf, i) => (
              <KeyframeDiamond
                key={`el-${i}`}
                at={kf.frame}
                color={resolveDescriptorMeta('title')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR}
                hovered={hoveredElementKf?.elementId === 'title' && hoveredElementKf?.frame === kf.frame}
                isSelected={isDiamondSelected(selectedDiamonds, { track: 'element', elementId: 'title', frame: kf.frame })}
                easingType={kf.easing}
                vp={vp}
                onDragStart={() => {
                  kfDragAtRef.current = kf.frame;
                  setDrag({ kind: 'element-keyframe', elementId: 'title' });
                }}
                onSelect={(shift) => onDiamondSelect({ track: 'element', elementId: 'title', frame: kf.frame }, shift)}
                onHover={(h) => setHoveredElementKf(h ? { elementId: 'title', frame: kf.frame } : null)}
              />
            ))}
          </div>
        </>
      );
    }
    case 'subtitle': {
      const subtitleElKfs = timeline.elementTracks['subtitle'] ?? [];
      return (
        <>
          <div style={subRow}>
            <ClipBar
              start={sl.scrollStart} end={sl.exitEnd}
              color={COLORS.subtitle} label="Subtitle"
              phases={{ enterEnd: sl.scrollEnd, exitStart: sl.exitStart }}
              resizable vp={vp}
              onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: 'subtitle', edge })}
              onSlideDrag={(e) => startClipSlide('subtitle', e)}
            />
          </div>
          <div style={subRow}>
            {subtitleElKfs.map((kf, i) => {
              if (i >= subtitleElKfs.length - 1) return null;
              return <KeyframeBar key={`elbar-${i}`} from={kf.frame} to={subtitleElKfs[i + 1].frame} color={resolveDescriptorMeta('subtitle')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR} easingType={subtitleElKfs[i + 1].easing} vp={vp} />;
            })}
            {subtitleElKfs.map((kf, i) => (
              <KeyframeDiamond
                key={`el-${i}`}
                at={kf.frame}
                color={resolveDescriptorMeta('subtitle')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR}
                hovered={hoveredElementKf?.elementId === 'subtitle' && hoveredElementKf?.frame === kf.frame}
                isSelected={isDiamondSelected(selectedDiamonds, { track: 'element', elementId: 'subtitle', frame: kf.frame })}
                easingType={kf.easing}
                vp={vp}
                onDragStart={() => {
                  kfDragAtRef.current = kf.frame;
                  setDrag({ kind: 'element-keyframe', elementId: 'subtitle' });
                }}
                onSelect={(shift) => onDiamondSelect({ track: 'element', elementId: 'subtitle', frame: kf.frame }, shift)}
                onHover={(h) => setHoveredElementKf(h ? { elementId: 'subtitle', frame: kf.frame } : null)}
              />
            ))}
          </div>
        </>
      );
    }
    case 'card': {
      const cl = timeline.cardLayout;
      const cardElKfs = timeline.elementTracks['card'] ?? [];
      return (
        <>
          <div style={subRow}>
            <ClipBar
              start={cl.scrollStart} end={cl.exitEnd}
              color={COLORS.card} label="Card"
              phases={{ enterEnd: cl.scrollEnd, exitStart: cl.exitStart }}
              resizable vp={vp}
              onEdgeDrag={(edge) => setDrag({ kind: 'clip-edge', trackId: 'card', edge })}
              onSlideDrag={(e) => startClipSlide('card', e)}
            />
          </div>
          <div style={subRow}>
            {cardElKfs.map((kf, i) => {
              if (i >= cardElKfs.length - 1) return null;
              return <KeyframeBar key={`elbar-${i}`} from={kf.frame} to={cardElKfs[i + 1].frame} color={resolveDescriptorMeta('card')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR} easingType={cardElKfs[i + 1].easing} vp={vp} />;
            })}
            {cardElKfs.map((kf, i) => (
              <KeyframeDiamond
                key={`el-${i}`}
                at={kf.frame}
                color={resolveDescriptorMeta('card')?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR}
                hovered={hoveredElementKf?.elementId === 'card' && hoveredElementKf?.frame === kf.frame}
                isSelected={isDiamondSelected(selectedDiamonds, { track: 'element', elementId: 'card', frame: kf.frame })}
                easingType={kf.easing}
                vp={vp}
                onDragStart={() => {
                  kfDragAtRef.current = kf.frame;
                  setDrag({ kind: 'element-keyframe', elementId: 'card' });
                }}
                onSelect={(shift) => onDiamondSelect({ track: 'element', elementId: 'card', frame: kf.frame }, shift)}
                onHover={(h) => setHoveredElementKf(h ? { elementId: 'card', frame: kf.frame } : null)}
              />
            ))}
          </div>
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
          <div style={subRow}>
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
          </div>
          <div style={subRow}>
            {elKfs.map((kf, i) => {
              if (i >= elKfs.length - 1) return null;
              return <KeyframeBar key={`bar-${i}`} from={kf.frame} to={elKfs[i + 1].frame} color={color} easingType={elKfs[i + 1].easing} vp={vp} />;
            })}
            {elKfs.map((kf, i) => (
              <KeyframeDiamond
                key={i}
                at={kf.frame}
                color={color}
                hovered={hoveredElementKf?.elementId === elId && hoveredElementKf?.frame === kf.frame}
                isSelected={isDiamondSelected(selectedDiamonds, { track: 'element', elementId: elId, frame: kf.frame })}
                easingType={kf.easing}
                vp={vp}
                onDragStart={() => {
                  kfDragAtRef.current = kf.frame;
                  setDrag({ kind: 'element-keyframe', elementId: elId });
                }}
                onSelect={(shift) => onDiamondSelect({ track: 'element', elementId: elId, frame: kf.frame }, shift)}
                onHover={(h) => setHoveredElementKf(h ? { elementId: elId, frame: kf.frame } : null)}
              />
            ))}
          </div>
        </>
      );
    }
  }
}
