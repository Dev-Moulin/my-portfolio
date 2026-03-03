import { useState, useRef, useEffect, useMemo } from 'react';
import { useSelector } from '@xstate/react';
import { useOvermind } from '../../hooks/useOvermind.ts';
import { useTimeline } from '../../hooks/useTimeline.ts';
import type { TrackId, DiamondRef, ClipboardEntry } from './types.ts';
import { DEFAULT_TRACK_ORDER, diamondEquals } from './types.ts';
import type { CameraKeyframe, ElementTransformKf, EyeWaypoint, EyePathPoint, Dwell } from '../../machines/timelineMachine.ts';
import {
  COLORS, HEADER_WIDTH,
  PANEL_HEIGHT_COLLAPSED, PANEL_HEIGHT_EXPANDED,
  s, getTrackColor, getTrackLabel,
} from './constants.ts';
import { Ruler, DwellMarker, Cursor, SnapGuideLine } from './sub-components.tsx';
import { Toolbar } from '../Toolbar.tsx';
import { useViewport } from './useViewport.ts';
import { useScrub } from './useScrub.ts';
import { useTimelineDrag } from './useTimelineDrag.ts';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.ts';
import { useExportImport } from './useExportImport.ts';
import { TrackContent } from './TrackContent.tsx';
import { EasingMenu } from './EasingMenu.tsx';
import type { EasingType } from '../../utils/easing.ts';

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
  const [collapsedTracks, setCollapsedTracks] = useState<Set<TrackId>>(new Set());

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
  const [selectedDiamonds, setSelectedDiamonds] = useState<DiamondRef[]>([]);
  const selectedDiamondsRef = useRef<DiamondRef[]>([]);
  selectedDiamondsRef.current = selectedDiamonds;
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const [easingMenuOpen, setEasingMenuOpen] = useState(false);
  const [clipboard, setClipboard] = useState<ClipboardEntry[]>([]);

  // ── 3D selection → track highlight ────────────────────────────────────────
  const selectedSceneIds: string[] = useSelector(
    selectionActor ?? undefined,
    (s) => s?.context.selectedIds ?? [],
  ) ?? [];
  const highlightedTracks = useMemo(() => {
    const set = new Set<TrackId>();
    for (const id of selectedSceneIds) {
      if (id.startsWith('eyePath:')) {
        set.add('eye-path');
      } else {
        set.add(`el:${id}` as TrackId);
      }
    }
    return set;
  }, [selectedSceneIds]);

  // ── Hooks ──────────────────────────────────────────────────────────────────

  const { viewStart, viewEnd, setViewStart, setViewEnd, vp, getProgressFromX, zoomToFit, resetZoom } =
    useViewport(trackAreaRef, timeline.totalFrames);

  const { drag, setDrag, dropIndex, kfDragAtRef, dwellDragIdxRef, eyeWpDragIdxRef, snapGuide } =
    useTimelineDrag({
      getProgressFromX, trackAreaRef, timeline, scrollText, camKf, trackOrder, setTrackOrder,
      selectedDiamondsRef, setSelectedDiamonds,
    });

  const { onTrackAreaMouseDown: onScrub } = useScrub(getProgressFromX, timelineActor, drag);

  // Wrap scrub to also deselect diamonds on empty-area click
  const onTrackAreaMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) return; // MMB handled by useViewport
    setSelectedDiamonds([]);
    setEasingMenuOpen(false);
    onScrub(e);
  };

  // ── Track bounds for zoom-to-fit ──────────────────────────────────────────

  function getTrackBounds(trackId: TrackId): { min: number; max: number } | null {
    switch (trackId) {
      case 'camera': {
        const kfs = camKf.keyframes;
        if (kfs.length === 0) return null;
        return { min: Math.min(...kfs.map(k => k.at)), max: Math.max(...kfs.map(k => k.at)) };
      }
      case 'eye': {
        const wps = timeline.eyeWaypoints;
        if (wps.length === 0) return null;
        return { min: Math.min(...wps.map(w => w.frame)), max: Math.max(...wps.map(w => w.frame)) };
      }
      case 'eye-path': {
        const pts = timeline.eyePath.points;
        if (pts.length === 0) return null;
        return { min: Math.min(...pts.map(p => p.frame)), max: Math.max(...pts.map(p => p.frame)) };
      }
      case 'title': return { min: tl.scrollStart, max: tl.exitEnd };
      case 'subtitle': return { min: sl.scrollStart, max: sl.exitEnd };
      case 'card': {
        const cl = timeline.cardLayout;
        return { min: cl.scrollStart, max: cl.exitEnd };
      }
      case 'visual': {
        const vkfs = timeline.visualKeyframes;
        if (vkfs.length === 0) return null;
        return {
          min: Math.min(...vkfs.map(v => v.at)),
          max: Math.max(...vkfs.map(v => v.at + v.duration)),
        };
      }
      default: {
        if (!trackId.startsWith('el:')) return null;
        const elId = trackId.slice(3);
        const lifecycle = timeline.instanceLifecycles[elId];
        const elKfs = timeline.elementTracks[elId] ?? [];
        const frames: number[] = [];
        if (lifecycle) { frames.push(lifecycle.scrollStart, lifecycle.exitEnd); }
        for (const kf of elKfs) frames.push(kf.frame);
        if (frames.length === 0) return null;
        return { min: Math.min(...frames), max: Math.max(...frames) };
      }
    }
  }

  function handleDiamondSelect(ref: DiamondRef, shiftKey: boolean) {
    setSelectedDiamonds(prev => {
      if (shiftKey) {
        const exists = prev.some(d => diamondEquals(d, ref));
        return exists ? prev.filter(d => !diamondEquals(d, ref)) : [...prev, ref];
      }
      return [ref];
    });
  }

  function getSelectedEasing(): EasingType | 'mixed' {
    if (selectedDiamonds.length === 0) return 'smoothstep';
    const easings = selectedDiamonds.map(d => {
      if (d.track === 'camera') {
        return camKf.keyframes.find(kf => kf.at === d.frame)?.easing;
      } else if (d.track === 'element' && d.elementId) {
        return timeline.elementTracks[d.elementId]?.find(
          kf => Math.round(kf.frame) === Math.round(d.frame)
        )?.easing;
      } else if (d.track === 'eye') {
        return timeline.eyeWaypoints.find(
          wp => Math.round(wp.frame) === Math.round(d.frame)
        )?.easing;
      } else if (d.track === 'eye-path') {
        return timeline.eyePath.points.find(
          pt => Math.round(pt.frame) === Math.round(d.frame)
        )?.easing;
      }
      return undefined;
    }).filter(Boolean) as EasingType[];
    if (easings.length === 0) return 'smoothstep';
    return easings.every(e => e === easings[0]) ? easings[0] : 'mixed';
  }

  function handleEasingSelect(easing: EasingType) {
    for (const d of selectedDiamonds) {
      if (d.track === 'camera') {
        const idx = camKf.keyframes.findIndex(kf => kf.at === d.frame);
        if (idx !== -1) camKf.updateKeyframe(idx, { ...camKf.keyframes[idx], easing });
      } else if (d.track === 'element' && d.elementId) {
        const track = timeline.elementTracks[d.elementId];
        const idx = track?.findIndex(kf => Math.round(kf.frame) === Math.round(d.frame));
        if (idx !== undefined && idx !== -1 && track) {
          timeline.updateElementKf(d.elementId, idx, { ...track[idx], easing });
        }
      } else if (d.track === 'eye') {
        const idx = timeline.eyeWaypoints.findIndex(wp => Math.round(wp.frame) === Math.round(d.frame));
        if (idx !== -1) timeline.updateEyeWp(idx, { ...timeline.eyeWaypoints[idx], easing });
      } else if (d.track === 'eye-path') {
        const idx = timeline.eyePath.points.findIndex(pt => Math.round(pt.frame) === Math.round(d.frame));
        if (idx !== -1) timeline.updateEyePathPt(idx, { ...timeline.eyePath.points[idx], easing });
      }
    }
    setEasingMenuOpen(false);
  }

  // ── Copy / Paste ─────────────────────────────────────────────────────────

  function handleCopy() {
    const sel = selectedDiamonds;
    if (sel.length === 0) return;
    const minFrame = Math.min(...sel.map(d => d.frame));
    const entries: ClipboardEntry[] = [];
    for (const d of sel) {
      const offset = d.frame - minFrame;
      if (d.track === 'camera') {
        const kf = camKf.keyframes.find(k => k.at === d.frame);
        if (kf) entries.push({ track: 'camera', frameOffset: offset, data: { ...kf } });
      } else if (d.track === 'element' && d.elementId) {
        const kf = timeline.elementTracks[d.elementId]?.find(
          k => Math.round(k.frame) === Math.round(d.frame)
        );
        if (kf) entries.push({ track: 'element', elementId: d.elementId, frameOffset: offset, data: { ...kf } });
      } else if (d.track === 'eye') {
        const wp = timeline.eyeWaypoints.find(
          w => Math.round(w.frame) === Math.round(d.frame)
        );
        if (wp) entries.push({ track: 'eye', frameOffset: offset, data: { ...wp } });
      } else if (d.track === 'eye-path') {
        const pt = timeline.eyePath.points.find(
          p => Math.round(p.frame) === Math.round(d.frame)
        );
        if (pt) entries.push({ track: 'eye-path', frameOffset: offset, data: { ...pt } });
      } else if (d.track === 'dwell') {
        const dw = timeline.dwells.find(dwell => dwell.at === d.frame);
        if (dw) entries.push({ track: 'dwell', frameOffset: offset, data: { ...dw } });
      }
    }
    setClipboard(entries);
  }

  function handlePaste() {
    if (clipboard.length === 0) return;
    const baseFrame = Math.round(timeline.currentFrame);
    for (const entry of clipboard) {
      const frame = baseFrame + entry.frameOffset;
      if (entry.track === 'camera') {
        const kf = entry.data as unknown as CameraKeyframe;
        camKf.addKeyframe({ ...kf, at: frame });
      } else if (entry.track === 'element' && entry.elementId) {
        const kf = entry.data as unknown as ElementTransformKf;
        timeline.addElementKf(entry.elementId, { ...kf, frame });
      } else if (entry.track === 'eye') {
        const wp = entry.data as unknown as EyeWaypoint;
        timeline.addEyeWp({ ...wp, frame });
      } else if (entry.track === 'eye-path') {
        const pt = entry.data as unknown as EyePathPoint;
        timeline.addEyePathPt({ ...pt, frame });
      } else if (entry.track === 'dwell') {
        const dw = entry.data as unknown as Dwell;
        timeline.addDwell({ ...dw, at: frame });
      }
    }
  }

  useKeyboardShortcuts({
    timeline, camKf, selectionActor,
    hoveredKfAt, setHoveredKfAt,
    hoveredDwellIdx, setHoveredDwellIdx,
    hoveredElementKf, setHoveredElementKf,
    hoveredEyeWpIdx, setHoveredEyeWpIdx,
    selectedDiamondsRef, setSelectedDiamonds,
    setDrag, kfDragAtRef,
    onOpenEasingMenu: () => setEasingMenuOpen(true),
    onResetZoom: resetZoom,
    onCopy: handleCopy,
    onPaste: handlePaste,
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
        {(viewStart > 0 || viewEnd < timeline.totalFrames) && (
          <button
            style={{
              background: 'none', border: '1px solid #333', borderRadius: '3px',
              color: '#888', fontSize: '9px', padding: '2px 6px', cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); resetZoom(); }}
            title="Reset zoom (Home)"
          >
            {'⟲'}
          </button>
        )}
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
          const isCollapsed = collapsedTracks.has(id);
          const isHighlighted = highlightedTracks.has(id);

          return (
            <div key={id} style={{
              ...s.trackRow,
              height: isCollapsed ? '14px' : undefined,
              opacity: isDragged ? 0.4 : 1,
              position: 'relative' as const,
              background: isHighlighted ? 'rgba(255, 255, 255, 0.06)' : undefined,
              borderLeft: isHighlighted ? `2px solid ${getTrackColor(id)}` : undefined,
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDrag({ kind: 'track-reorder', trackId: id });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  const bounds = getTrackBounds(id);
                  if (bounds) zoomToFit(bounds.min, bounds.max);
                }}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCollapsedTracks(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      return next;
                    });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', fontSize: '7px', lineHeight: 1, flexShrink: 0 }}
                  title={isCollapsed ? 'Expand track' : 'Collapse track'}
                >
                  {isCollapsed ? '\u25B6' : '\u25BC'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getTrackLabel(id)}
                </span>
              </div>
              {!isCollapsed && (
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
                    selectedDiamonds={selectedDiamonds}
                    onDiamondSelect={handleDiamondSelect}
                  />
                </div>
              )}
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

        {/* Snap guide overlay */}
        {snapGuide && (
          <div style={{
            position: 'absolute',
            left: `${HEADER_WIDTH}px`,
            right: 0,
            top: '18px',
            bottom: 0,
            pointerEvents: 'none',
          }}>
            <SnapGuideLine frame={snapGuide.frame} vp={vp} />
          </div>
        )}

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

        {/* Easing menu */}
        {easingMenuOpen && (
          <EasingMenu
            currentEasing={getSelectedEasing()}
            onSelect={handleEasingSelect}
            onClose={() => setEasingMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
