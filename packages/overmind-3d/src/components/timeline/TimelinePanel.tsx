import { useState, useRef, useEffect } from 'react';
import { useOvermind } from '../../hooks/useOvermind.ts';
import { useTimeline } from '../../hooks/useTimeline.ts';
import type { TrackId } from './types.ts';
import { DEFAULT_TRACK_ORDER } from './types.ts';
import {
  COLORS, HEADER_WIDTH,
  PANEL_HEIGHT_COLLAPSED, PANEL_HEIGHT_EXPANDED,
  s, getTrackColor, getTrackLabel,
} from './constants.ts';
import { Ruler, DwellMarker, Cursor } from './sub-components.tsx';
import { Toolbar } from '../Toolbar.tsx';
import { useViewport } from './useViewport.ts';
import { useScrub } from './useScrub.ts';
import { useTimelineDrag } from './useTimelineDrag.ts';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.ts';
import { useExportImport } from './useExportImport.ts';
import { TrackContent } from './TrackContent.tsx';

// ── Main Component ───────────────────────────────────────────────────────────

export function TimelinePanel() {
  const { timelineActor, selectionActor } = useOvermind();
  if (!timelineActor) return null;

  return <TimelinePanelContent timelineActor={timelineActor} selectionActor={selectionActor} />;
}

function TimelinePanelContent({ timelineActor, selectionActor }: {
  timelineActor: Parameters<typeof useTimeline>[0];
  selectionActor: ReturnType<typeof useOvermind>['selectionActor'];
}) {
  const timeline = useTimeline(timelineActor);

  // Aliases for minimal JSX changes
  const scrollText = {
    setTitleLayout: timeline.setTitleLayout,
    setSubtitleLayout: timeline.setSubtitleLayout,
  };
  const camKf = {
    keyframes: timeline.cameraKeyframes,
    addKeyframe: timeline.addKeyframe,
    updateKeyframe: timeline.updateKeyframe,
    deleteKeyframe: timeline.deleteKeyframe,
  };

  const [expanded, setExpanded] = useState(true);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [trackOrder, setTrackOrder] = useState<TrackId[]>([...DEFAULT_TRACK_ORDER]);

  // Sync trackOrder: add missing fixed tracks + dynamic element tracks, remove empty dynamic tracks
  useEffect(() => {
    setTrackOrder(prev => {
      // Remove dynamic tracks whose element tracks are now empty AND have no cardLayout
      const existing = prev.filter(id => {
        if (!id.startsWith('el:')) return true;
        const elId = id.slice(3);
        const hasKfs = (timeline.elementTracks[elId]?.length ?? 0) > 0;
        const hasLifecycle = !!timeline.instanceLifecycles[elId];
        return hasKfs || hasLifecycle;
      });
      // Add missing fixed tracks
      const missingFixed = DEFAULT_TRACK_ORDER.filter(id => !existing.includes(id));
      // Add dynamic element tracks that don't overlap with fixed tracks
      const fixedSet = new Set<string>(['camera', 'title', 'subtitle', 'card', 'visual']);
      const dynamicElIds = new Set([
        ...Object.keys(timeline.elementTracks).filter(id => (timeline.elementTracks[id]?.length ?? 0) > 0),
        ...Object.keys(timeline.instanceLifecycles),
      ]);
      const dynamicIds = Array.from(dynamicElIds)
        .filter(id => !fixedSet.has(id))
        .map(id => `el:${id}` as TrackId);
      const missingDynamic = dynamicIds.filter(id => !existing.includes(id));
      if (missingFixed.length === 0 && missingDynamic.length === 0 && existing.length === prev.length) return prev;
      return [...existing, ...missingFixed, ...missingDynamic];
    });
  }, [timeline.elementTracks, timeline.instanceLifecycles]);

  const [hoveredKfAt, setHoveredKfAt] = useState<number | null>(null);
  const [hoveredDwellIdx, setHoveredDwellIdx] = useState<number | null>(null);
  const [hoveredElementKf, setHoveredElementKf] = useState<{ elementId: string; frame: number } | null>(null);
  const [hoveredEyeWpIdx, setHoveredEyeWpIdx] = useState<number | null>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  // ── Hooks ──────────────────────────────────────────────────────────────────

  const { viewStart, viewEnd, setViewStart, setViewEnd, vp, getProgressFromX } =
    useViewport(trackAreaRef, timeline.totalFrames);

  const { drag, setDrag, dropIndex, kfDragAtRef, dwellDragIdxRef, eyeWpDragIdxRef } =
    useTimelineDrag({
      getProgressFromX, trackAreaRef, timeline, scrollText, camKf, trackOrder, setTrackOrder,
    });

  const { onTrackAreaMouseDown } = useScrub(getProgressFromX, timelineActor, drag);

  useKeyboardShortcuts({
    timeline, camKf, selectionActor,
    hoveredKfAt, setHoveredKfAt,
    hoveredDwellIdx, setHoveredDwellIdx,
    hoveredElementKf, setHoveredElementKf,
    hoveredEyeWpIdx, setHoveredEyeWpIdx,
  });

  const { handleExport, handleImport, fileInputRef } = useExportImport(timeline);

  // ── Clip slide helper ──────────────────────────────────────────────────────

  const tl = timeline.titleLayout;
  const sl = timeline.subtitleLayout;

  function startClipSlide(trackId: TrackId, e: React.MouseEvent) {
    const mouseP = getProgressFromX(e.clientX);
    const cardInstId = trackId.startsWith('el:') ? trackId.slice(3) : null;
    const layout = trackId === 'title' ? tl
      : trackId === 'subtitle' ? sl
      : trackId === 'card' ? timeline.cardLayout
      : (cardInstId && timeline.instanceLifecycles[cardInstId]) ? timeline.instanceLifecycles[cardInstId]
      : null;
    if (!layout) return;
    setDrag({
      kind: 'clip-slide',
      trackId,
      grabOffset: mouseP - layout.scrollStart,
      original: {
        scrollStart: layout.scrollStart,
        scrollEnd: layout.scrollEnd,
        exitStart: layout.exitStart,
        exitEnd: layout.exitEnd,
      },
    });
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const progress = timeline.currentFrame;

  const panelStyle = {
    ...s.panel,
    [position]: 0,
    transform: expanded ? 'translateY(0)' : (
      position === 'bottom'
        ? `translateY(${PANEL_HEIGHT_EXPANDED - PANEL_HEIGHT_COLLAPSED}px)`
        : `translateY(-${PANEL_HEIGHT_EXPANDED - PANEL_HEIGHT_COLLAPSED}px)`
    ),
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={panelStyle}>
      {/* Toolbar */}
      <div style={s.toolbar} onClick={() => setExpanded(!expanded)}>
        <span style={s.toolbarTitle}>
          {expanded ? '▾' : '▸'} Timeline
        </span>
        <span style={{ color: '#4ade80', fontSize: '10px', fontFamily: 'monospace' }}>
          {Math.round(progress)}
        </span>
        <input
          type="number"
          min={0} max={timeline.totalFrames} step={1}
          style={s.numInput as React.CSSProperties}
          value={Math.round(progress)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = Math.max(0, Math.min(timeline.totalFrames, +e.target.value));
            timeline.updateFrame(v);
          }}
        />
        <span style={{ color: '#555', fontSize: '8px', userSelect: 'none' }}>view</span>
        <input
          type="number"
          min={0} step={1}
          style={{ ...s.numInput, width: '50px' } as React.CSSProperties}
          value={Math.round(viewStart)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = Math.max(0, Math.min(viewEnd - 1, +e.target.value));
            setViewStart(v);
          }}
        />
        <span style={{ color: '#555', fontSize: '8px', userSelect: 'none' }}>—</span>
        <input
          type="number"
          min={1} step={1}
          style={{ ...s.numInput, width: '50px' } as React.CSSProperties}
          value={Math.round(viewEnd)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = Math.max(viewStart + 1, +e.target.value);
            setViewEnd(v);
          }}
        />
        <div style={{ flex: 1 }} />
        {selectionActor && <Toolbar selectionActor={selectionActor} />}
        <button
          style={{
            background: 'none', border: '1px solid #333', borderRadius: '3px',
            color: '#888', fontSize: '9px', padding: '2px 6px', cursor: 'pointer',
          }}
          onClick={(e) => { e.stopPropagation(); handleExport(); }}
          title="Export full timeline"
        >
          {'⬇'}
        </button>
        <button
          style={{
            background: 'none', border: '1px solid #333', borderRadius: '3px',
            color: '#888', fontSize: '9px', padding: '2px 6px', cursor: 'pointer',
          }}
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          title="Import full timeline"
        >
          {'⬆'}
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
        <button
          style={{
            background: 'none', border: '1px solid #333', borderRadius: '3px',
            color: '#888', fontSize: '9px', padding: '2px 6px', cursor: 'pointer',
          }}
          onClick={(e) => { e.stopPropagation(); setPosition(p => p === 'bottom' ? 'top' : 'bottom'); }}
          title={`Move to ${position === 'bottom' ? 'top' : 'bottom'}`}
        >
          {position === 'bottom' ? '↑' : '↓'}
        </button>
      </div>

      {/* Tracks area */}
      <div
        ref={trackAreaRef}
        style={s.tracksContainer}
        onMouseDown={onTrackAreaMouseDown}
      >
        <Ruler viewStart={viewStart} viewEnd={viewEnd} vp={vp} />

        {trackOrder.map((id, idx) => {
          const isDragged = drag?.kind === 'track-reorder' && drag.trackId === id;
          const showDrop = drag?.kind === 'track-reorder' && dropIndex === idx && drag.trackId !== id;

          return (
            <div key={id} style={{
              ...s.trackRow,
              opacity: isDragged ? 0.4 : 1,
              position: 'relative' as const,
            }}>
              {showDrop && (
                <div style={{
                  position: 'absolute', top: -1, left: 0, right: 0,
                  height: '2px', background: COLORS.dropLine, zIndex: 5,
                }} />
              )}
              <div
                style={{
                  ...s.trackLabel,
                  color: getTrackColor(id),
                  cursor: drag?.kind === 'track-reorder' ? 'grabbing' : 'grab',
                  userSelect: 'none' as const,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDrag({ kind: 'track-reorder', trackId: id });
                }}
              >
                {getTrackLabel(id)}
              </div>
              <div style={s.trackContent} data-track-content>
                <TrackContent
                  id={id}
                  vp={vp}
                  timeline={timeline}
                  camKfKeyframes={camKf.keyframes}
                  setDrag={setDrag}
                  kfDragAtRef={kfDragAtRef}
                  eyeWpDragIdxRef={eyeWpDragIdxRef}
                  hoveredKfAt={hoveredKfAt}
                  setHoveredKfAt={setHoveredKfAt}
                  hoveredElementKf={hoveredElementKf}
                  setHoveredElementKf={setHoveredElementKf}
                  hoveredEyeWpIdx={hoveredEyeWpIdx}
                  setHoveredEyeWpIdx={setHoveredEyeWpIdx}
                  getProgressFromX={getProgressFromX}
                  startClipSlide={startClipSlide}
                />
              </div>
            </div>
          );
        })}

        {/* Interactive dwell markers */}
        <div style={{
          position: 'absolute',
          left: `${HEADER_WIDTH}px`,
          right: 0,
          top: '18px',
          bottom: 0,
          pointerEvents: 'none',
        }}>
          {timeline.dwells.map((d: { at: number; duration: number }, i: number) => (
            <DwellMarker
              key={i}
              at={d.at}
              vp={vp}
              hovered={hoveredDwellIdx === i}
              onDragStart={() => {
                dwellDragIdxRef.current = i;
                setDrag({ kind: 'dwell' });
              }}
              onHover={(h) => setHoveredDwellIdx(h ? i : null)}
            />
          ))}
        </div>

        {/* Cursor overlay (non-interactive) */}
        <div style={{
          position: 'absolute',
          left: `${HEADER_WIDTH}px`,
          right: 0,
          top: '18px',
          bottom: 0,
          pointerEvents: 'none',
        }}>
          <Cursor progress={progress} vp={vp} />
        </div>
      </div>
    </div>
  );
}
