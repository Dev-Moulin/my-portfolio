import type { ClipEdge } from './types.ts';
import { COLORS, HEADER_WIDTH, EDGE_HANDLE_W, s } from './constants.ts';

// ── Ruler ───────────────────────────────────────────────────────────────────

export function Ruler({ viewStart, viewEnd, vp }: { viewStart: number; viewEnd: number; vp: (v: number) => string }) {
  const range = viewEnd - viewStart;
  const majorCount = 10;
  const step = range / majorCount;
  const ticks: { at: number; label: string; major: boolean }[] = [];

  for (let i = 0; i <= majorCount; i++) {
    const v = viewStart + i * step;
    ticks.push({ at: v, label: Math.round(v).toString(), major: true });
  }
  for (let i = 1; i < majorCount * 2; i++) {
    if (i % 2 !== 0) {
      ticks.push({ at: viewStart + i * step / 2, label: '', major: false });
    }
  }

  return (
    <div style={s.rulerRow}>
      <div style={{ width: `${HEADER_WIDTH}px`, flexShrink: 0 }} />
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        {ticks.map((tick, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: vp(tick.at),
            bottom: 0,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: tick.major ? '8px' : '0',
              color: '#555',
              marginBottom: '1px',
              userSelect: 'none',
            }}>
              {tick.label}
            </span>
            <div style={{
              width: '1px',
              height: tick.major ? '6px' : '3px',
              background: tick.major ? '#444' : '#2a2a2a',
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── EdgeHandle ──────────────────────────────────────────────────────────────

export function EdgeHandle({ side, position: pos, onStart }: {
  side: 'left' | 'right' | 'inner';
  position?: string;
  onStart: () => void;
}) {
  const isInner = side === 'inner';
  const posStyle: React.CSSProperties = isInner
    ? { left: pos, transform: 'translateX(-50%)' }
    : side === 'left'
      ? { left: 0 }
      : { right: 0 };

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onStart(); }}
      style={{
        position: 'absolute', top: 0, bottom: 0,
        width: `${EDGE_HANDLE_W}px`, cursor: 'ew-resize', zIndex: isInner ? 3 : 2,
        ...posStyle,
      }}
    >
      <div style={{
        position: 'absolute',
        ...(side === 'right' ? { right: '1px' } : { left: '1px' }),
        ...(isInner ? { left: '50%', transform: 'translateX(-50%)' } : {}),
        top: '15%', bottom: '15%',
        width: '2px', borderRadius: '1px',
        background: isInner ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)',
      }} />
    </div>
  );
}

// ── ClipBar ─────────────────────────────────────────────────────────────────

export function ClipBar({ start, end, color, label, phases, resizable, onEdgeDrag, onSlideDrag, vp }: {
  start: number;
  end: number;
  color: string;
  label?: string;
  phases?: { enterEnd: number; exitStart: number };
  resizable?: boolean;
  onEdgeDrag?: (edge: ClipEdge) => void;
  onSlideDrag?: (e: React.MouseEvent) => void;
  vp: (v: number) => string;
}) {
  const width = end - start;
  if (width <= 0) return null;

  const innerPct = (v: number) => `${((v - start) / width * 100).toFixed(2)}%`;

  return (
    <div
      onMouseDown={onSlideDrag ? (e) => {
        e.stopPropagation();
        e.preventDefault();
        onSlideDrag(e);
      } : undefined}
      style={{
        position: 'absolute',
        left: vp(start),
        width: vp(width),
        top: '3px',
        bottom: '3px',
        borderRadius: '3px',
        background: `${color}33`,
        border: `1px solid ${color}66`,
        overflow: 'hidden',
        display: 'flex',
        cursor: onSlideDrag ? 'move' : 'default',
      }}
      title={label ? `${label}: ${Math.round(start)} → ${Math.round(end)}` : undefined}
    >
      {phases && (
        <>
          <div style={{
            width: innerPct(phases.enterEnd),
            background: `${color}55`,
            height: '100%',
            borderRight: `1px solid ${color}44`,
          }} />
          <div style={{
            flex: 1,
            background: `${color}88`,
            height: '100%',
          }} />
          <div style={{
            width: `${((end - phases.exitStart) / width * 100).toFixed(2)}%`,
            background: `${color}55`,
            height: '100%',
            borderLeft: `1px solid ${color}44`,
          }} />
        </>
      )}
      {resizable && onEdgeDrag && (
        <>
          <EdgeHandle side="left" onStart={() => onEdgeDrag('start')} />
          <EdgeHandle side="right" onStart={() => onEdgeDrag('end')} />
          {phases && (
            <>
              <EdgeHandle side="inner" position={innerPct(phases.enterEnd)} onStart={() => onEdgeDrag('enterEnd')} />
              <EdgeHandle side="inner" position={`${((phases.exitStart - start) / width * 100).toFixed(2)}%`} onStart={() => onEdgeDrag('exitStart')} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── KeyframeBar (Blender dopesheet-style bar between consecutive keyframes) ─

export function KeyframeBar({ from, to, color, vp }: {
  from: number;
  to: number;
  color: string;
  vp: (v: number) => string;
}) {
  const width = to - from;
  if (width <= 0) return null;
  return (
    <div style={{
      position: 'absolute',
      left: vp(from),
      width: vp(width),
      top: '50%',
      transform: 'translateY(-50%)',
      height: '4px',
      background: `${color}55`,
      borderRadius: '2px',
      pointerEvents: 'none',
    }} />
  );
}

// ── KeyframeDiamond ─────────────────────────────────────────────────────────

export function KeyframeDiamond({ at, color, hovered, onDragStart, onHover, vp }: {
  at: number;
  color: string;
  hovered?: boolean;
  onDragStart?: () => void;
  onHover?: (hovered: boolean) => void;
  vp: (v: number) => string;
}) {
  return (
    <div
      onMouseDown={onDragStart ? (e) => {
        e.stopPropagation();
        e.preventDefault();
        onDragStart();
      } : undefined}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      style={{
        position: 'absolute',
        left: vp(at),
        top: '50%',
        transform: 'translate(-50%, -50%) rotate(45deg)',
        width: hovered ? '10px' : '8px',
        height: hovered ? '10px' : '8px',
        background: hovered ? COLORS.kfHover : color,
        border: `1px solid ${hovered ? COLORS.kfHover : color}`,
        boxShadow: `0 0 ${hovered ? '8' : '4'}px ${color}88`,
        borderRadius: '1px',
        cursor: onDragStart ? 'ew-resize' : 'default',
        transition: 'width 0.1s, height 0.1s, background 0.1s',
      }}
      title={`Keyframe at frame ${Math.round(at)}${hovered ? ' — [D] delete' : ''}`}
    />
  );
}

// ── DwellMarker ─────────────────────────────────────────────────────────────

export function DwellMarker({ at, vp, hovered, onDragStart, onHover }: {
  at: number;
  vp: (v: number) => string;
  hovered?: boolean;
  onDragStart?: () => void;
  onHover?: (hovered: boolean) => void;
}) {
  return (
    <div
      onMouseDown={onDragStart ? (e) => {
        e.stopPropagation();
        e.preventDefault();
        onDragStart();
      } : undefined}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      style={{
        position: 'absolute',
        left: vp(at),
        top: 0,
        bottom: 0,
        width: '8px',
        transform: 'translateX(-50%)',
        cursor: onDragStart ? 'ew-resize' : 'default',
        pointerEvents: 'auto',
        zIndex: 4,
      }}
      title={`Dwell at frame ${Math.round(at)}${hovered ? ' — [D] delete' : ''}`}
    >
      {/* Visible line */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        width: '2px',
        transform: 'translateX(-50%)',
        background: hovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
        transition: 'background 0.15s',
      }} />
      <div style={{
        position: 'absolute',
        top: '-14px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '7px',
        color: hovered ? '#fff' : '#555',
        whiteSpace: 'nowrap',
        transition: 'color 0.15s',
      }}>
        {Math.round(at)}
      </div>
    </div>
  );
}

// ── Cursor ──────────────────────────────────────────────────────────────────

export function Cursor({ progress, vp }: { progress: number; vp: (v: number) => string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: vp(progress),
        top: 0,
        bottom: 0,
        width: '2px',
        background: COLORS.cursor,
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        boxShadow: `0 0 6px ${COLORS.cursor}88`,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '-2px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: `6px solid ${COLORS.cursor}`,
      }} />
    </div>
  );
}
