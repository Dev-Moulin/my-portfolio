import { DESCRIPTOR_META } from '../../../scene/descriptors/index.ts';
import { s } from '../styles.ts';

const COMPONENT_TYPES = ['text', 'light', 'card'] as const;

export function LibraryTab() {
  function handleAdd(type: string) {
    window.dispatchEvent(
      new CustomEvent('overmind:create-instance', { detail: { type } }),
    );
  }

  return (
    <div style={s.section}>
      <h3 style={s.h3}>Add Component</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {COMPONENT_TYPES.map(type => {
          const meta = DESCRIPTOR_META[type];
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
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
              title={`Add new ${meta.displayName}`}
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
              <span style={{ fontSize: '9px', color: '#666' }}>+ Add</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
