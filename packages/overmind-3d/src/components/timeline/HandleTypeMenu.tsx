import { useEffect, useRef } from 'react';
import type { HandleType } from '../../machines/timeline/types.ts';

// ── Options ──────────────────────────────────────────────────────────────────

const HANDLE_TYPE_OPTIONS: HandleType[] = ['auto', 'aligned', 'free'];

const HANDLE_TYPE_LABELS: Record<HandleType, string> = {
  auto: 'Auto',
  aligned: 'Aligned',
  free: 'Free',
};

const HANDLE_TYPE_COLORS: Record<HandleType, string> = {
  auto: '#FFEB3B',
  aligned: '#FF69B4',
  free: '#666',
};

// ── Component ────────────────────────────────────────────────────────────────

interface HandleTypeMenuProps {
  currentType: HandleType | 'mixed';
  onSelect: (type: HandleType) => void;
  onClose: () => void;
}

export function HandleTypeMenu({ currentType, onSelect, onClose }: HandleTypeMenuProps) {
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
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        minWidth: '140px',
      }}
    >
      <div style={{
        padding: '2px 10px 4px',
        fontSize: '9px',
        color: '#666',
        borderBottom: '1px solid #2a2a2a',
        userSelect: 'none',
      }}>
        Handle Type{currentType === 'mixed' ? ' (mixed)' : ''}
      </div>
      {HANDLE_TYPE_OPTIONS.map((type) => {
        const active = currentType === type;
        return (
          <div
            key={type}
            onClick={(e) => { e.stopPropagation(); onSelect(type); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 10px',
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
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: HANDLE_TYPE_COLORS[type],
              flexShrink: 0,
            }} />
            <span>{HANDLE_TYPE_LABELS[type]}</span>
            {active && <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#4ade80' }}>*</span>}
          </div>
        );
      })}
    </div>
  );
}
