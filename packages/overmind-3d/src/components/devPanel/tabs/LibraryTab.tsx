import { useState, useMemo } from 'react';
import { DESCRIPTOR_META } from '../../../scene/descriptors/index.ts';
import { generateBandColors, NEON_THEME_LABELS } from '../../../utils/neonThemes.ts';
import { s } from '../styles.ts';

const COMPONENT_TYPES = ['neon', 'text', 'light', 'card'] as const;

export function LibraryTab() {
  const [neonOpen, setNeonOpen] = useState(false);
  const [bandCount, setBandCount] = useState(10);
  const [theme, setTheme] = useState('Sunset');

  const previewBands = useMemo(
    () => generateBandColors(bandCount, theme),
    [bandCount, theme],
  );

  function handleAdd(type: string) {
    if (type === 'neon') {
      setNeonOpen(prev => !prev);
      return;
    }
    window.dispatchEvent(
      new CustomEvent('overmind:create-instance', { detail: { type } }),
    );
  }

  function handleCreateNeon() {
    const bands = generateBandColors(bandCount, theme);
    window.dispatchEvent(
      new CustomEvent('overmind:create-instance', { detail: { type: 'neon', bands } }),
    );
  }

  return (
    <div style={s.section}>
      <h3 style={s.h3}>Add Component</h3>

      {/* Grid 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {COMPONENT_TYPES.map(type => {
          const meta = DESCRIPTOR_META[type];
          const isNeon = type === 'neon';
          return (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              style={{
                display: 'flex',
                flexDirection: 'column' as const,
                alignItems: 'center',
                gap: '4px',
                padding: '10px 8px',
                background: isNeon && neonOpen ? '#1e2a1e' : '#1a1a1a',
                border: `1px solid ${isNeon && neonOpen ? '#4ade80' : '#2a2a2a'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
              title={isNeon ? 'Configure neon bands' : `Add new ${meta.displayName}`}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: meta.trackColor,
                boxShadow: `0 0 8px ${meta.trackColor}40`,
              }} />
              <span style={{ fontSize: '11px', color: '#ccc', fontWeight: 500 }}>
                {meta.displayName}
              </span>
              <span style={{ fontSize: '9px', color: '#666' }}>
                {isNeon ? (neonOpen ? 'Configure' : '+ Add') : '+ Add'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Neon Configurator */}
      {neonOpen && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
        }}>
          <h3 style={{ ...s.h3, marginBottom: '6px' }}>Neon Configurator</h3>

          {/* Band count slider */}
          <div style={s.row}>
            <label style={s.label}>Bands: {bandCount}</label>
            <input
              type="range"
              min={1}
              max={50}
              value={bandCount}
              onChange={e => setBandCount(Number(e.target.value))}
              style={s.range}
            />
          </div>

          {/* Theme selector */}
          <div style={s.row}>
            <label style={s.label}>Theme</label>
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              style={s.select}
            >
              {NEON_THEME_LABELS.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>

          {/* Color preview strip */}
          <div style={{ ...s.row, marginBottom: '8px' }}>
            <label style={s.label}>Preview</label>
            <div style={{
              display: 'flex',
              height: '16px',
              borderRadius: '3px',
              overflow: 'hidden',
              border: '1px solid #2a2a2a',
            }}>
              {previewBands.map((band, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: band.color,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Create button */}
          <button style={s.btnPrimary} onClick={handleCreateNeon}>
            Create Neon ({bandCount} bands)
          </button>
        </div>
      )}
    </div>
  );
}
