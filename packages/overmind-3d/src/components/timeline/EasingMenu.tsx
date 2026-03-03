import { useEffect, useRef } from 'react';
import type { EasingType } from '../../utils/easing.ts';
import { EASING_OPTIONS, EASING_LABELS, EASING_MAP } from '../../utils/easing.ts';

// ── Mini SVG curve ───────────────────────────────────────────────────────────

function MiniCurve({ easing, active }: { easing: EasingType; active: boolean }) {
  const fn = EASING_MAP[easing];
  const points = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    const y = fn(t);
    return `${2 + t * 36},${14 - Math.min(Math.max(y, -0.2), 1.2) * 12}`;
  }).join(' ');
  return (
    <svg width="40" height="16" viewBox="0 0 40 16" style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={active ? '#fff' : '#4ade80'} strokeWidth="1.5" />
    </svg>
  );
}

// ── EasingMenu ───────────────────────────────────────────────────────────────

interface EasingMenuProps {
  currentEasing: EasingType | 'mixed';
  onSelect: (easing: EasingType) => void;
  onClose: () => void;
}

export function EasingMenu({ currentEasing, onSelect, onClose }: EasingMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '6px',
        padding: '4px 0',
        zIndex: 10,
        maxHeight: '260px',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        minWidth: '180px',
      }}
    >
      <div style={{
        padding: '2px 10px 4px',
        fontSize: '9px',
        color: '#666',
        borderBottom: '1px solid #2a2a2a',
        userSelect: 'none',
      }}>
        Easing{currentEasing === 'mixed' ? ' (mixed)' : ''}
      </div>
      {EASING_OPTIONS.map((easing) => {
        const active = currentEasing === easing;
        return (
          <div
            key={easing}
            onClick={(e) => { e.stopPropagation(); onSelect(easing); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 10px',
              cursor: 'pointer',
              background: active ? '#2a3a4a' : 'transparent',
              color: active ? '#fff' : '#aaa',
              fontSize: '11px',
              fontFamily: 'monospace',
              userSelect: 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = active ? '#2a3a4a' : '#222'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = active ? '#2a3a4a' : 'transparent'; }}
          >
            <MiniCurve easing={easing} active={active} />
            <span>{EASING_LABELS[easing]}</span>
            {active && <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#4ade80' }}>*</span>}
          </div>
        );
      })}
    </div>
  );
}
