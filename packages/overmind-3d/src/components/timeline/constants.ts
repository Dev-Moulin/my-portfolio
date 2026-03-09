import { resolveDescriptorMeta } from '../../scene/descriptors/index.ts';
import type { TrackId, ClipEdge } from './types.ts';

// ── Dimensions ──────────────────────────────────────────────────────────────

export const TRACK_HEIGHT = 22;
export const HEADER_WIDTH = 80;
export const PANEL_HEIGHT_COLLAPSED = 32;
export const PANEL_HEIGHT_EXPANDED = 180;
export const EDGE_HANDLE_W = 6;
export const MIN_ZOOM_RANGE = 5;
export const ZOOM_PADDING = 0.05;
export const SNAP_THRESHOLD_PX = 8;

// ── Colors ──────────────────────────────────────────────────────────────────

export const COLORS = {
  camera: '#4FC3F7',
  title: '#81C784',
  subtitle: '#AED581',
  card: '#FFB74D',
  visual: '#E040FB',
  cursor: '#ef4444',
  bg: '#0a0a0a',
  border: '#1a1a1a',
  text: '#888',
  textBright: '#ccc',
  dropLine: '#4FC3F7',
  kfHover: '#fff',
};

// ── Styles ──────────────────────────────────────────────────────────────────

export const s = {
  panel: {
    position: 'fixed' as const,
    left: 0,
    right: 0,
    height: `${PANEL_HEIGHT_EXPANDED}px`,
    background: COLORS.bg,
    borderTop: `1px solid ${COLORS.border}`,
    fontFamily: '"Courier New", monospace',
    fontSize: '10px',
    color: COLORS.text,
    zIndex: 9998,
    transition: 'transform 0.3s ease',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    borderBottom: `1px solid ${COLORS.border}`,
    height: `${PANEL_HEIGHT_COLLAPSED}px`,
    flexShrink: 0,
    cursor: 'pointer',
  },
  toolbarTitle: {
    fontWeight: 700,
    color: COLORS.textBright,
    fontSize: '11px',
    userSelect: 'none' as const,
  },
  numInput: {
    width: '60px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '10px',
    padding: '2px 4px',
    textAlign: 'right' as const,
    fontFamily: 'inherit',
  },
  tracksContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflowX: 'hidden' as const,
    overflowY: 'auto' as const,
    position: 'relative' as const,
  },
  trackRow: {
    display: 'flex',
    height: `${TRACK_HEIGHT}px`,
    borderBottom: `1px solid ${COLORS.border}`,
    alignItems: 'center',
  },
  trackLabel: {
    width: `${HEADER_WIDTH}px`,
    padding: '0 8px',
    fontSize: '9px',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackContent: {
    flex: 1,
    position: 'relative' as const,
    height: '100%',
  },
  rulerRow: {
    display: 'flex',
    height: '18px',
    borderBottom: `1px solid ${COLORS.border}`,
    alignItems: 'flex-end',
  },
};

// ── Track Config ────────────────────────────────────────────────────────────

const FIXED_TRACK_COLORS: Record<string, string> = {
  camera: COLORS.camera,
  'eye-path': '#FFEB3B',
  title: COLORS.title,
  subtitle: COLORS.subtitle,
  card: COLORS.card,
  visual: COLORS.visual,
};

const FIXED_TRACK_LABELS: Record<string, string> = {
  camera: 'Camera',
  'eye-path': 'Eye Path',
  title: 'Title',
  subtitle: 'Subtitle',
  card: 'Card',
  visual: 'Visual',
};

export const ELEMENT_TRACK_DEFAULT_COLOR = '#90A4AE';

export function getTrackColor(id: TrackId): string {
  if (id in FIXED_TRACK_COLORS) return FIXED_TRACK_COLORS[id];
  if (id.startsWith('el:')) {
    const meta = resolveDescriptorMeta(id.slice(3));
    return meta?.trackColor ?? ELEMENT_TRACK_DEFAULT_COLOR;
  }
  return COLORS.text;
}

export function getTrackLabel(id: TrackId): string {
  if (id in FIXED_TRACK_LABELS) return FIXED_TRACK_LABELS[id];
  if (id.startsWith('el:')) {
    const elId = id.slice(3);
    const meta = resolveDescriptorMeta(elId);
    const baseName = meta?.displayName ?? elId.charAt(0).toUpperCase() + elId.slice(1);
    const idx = elId.lastIndexOf('_');
    if (idx !== -1) return `${baseName} #${elId.slice(idx + 1)}`;
    return `${baseName} \u25c8`;
  }
  return id;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function edgeToField(edge: ClipEdge): string {
  switch (edge) {
    case 'start': return 'scrollStart';
    case 'enterEnd': return 'scrollEnd';
    case 'exitStart': return 'exitStart';
    case 'end': return 'exitEnd';
  }
}
