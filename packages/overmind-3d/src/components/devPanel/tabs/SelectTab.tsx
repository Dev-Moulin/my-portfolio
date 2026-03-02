import type { useSelection } from '../../../hooks/useSelection.ts';
import type { useInstanceConfig } from '../../../hooks/useInstanceConfig.ts';
import { InstanceEditSection } from './InstanceEditSection.tsx';
import { s } from '../styles.ts';

const MODES = ['translate', 'rotate', 'scale'] as const;

interface SelectTabProps {
  selection: ReturnType<typeof useSelection>;
  instanceConfig: ReturnType<typeof useInstanceConfig>;
}

export function SelectTab({ selection, instanceConfig }: SelectTabProps) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Selection</h3>
        <div style={s.row}>
          <label style={s.label}>Selected:</label>
          <span style={{ color: selection.selectedIds.length > 0 ? '#FF9800' : '#666', fontWeight: 600 }}>
            {selection.selectedIds.length > 0 ? selection.selectedIds.join(', ') : 'None'}
          </span>
        </div>
        <div style={s.row}>
          <label style={s.label}>Transforming:</label>
          <span style={{ color: selection.isTransforming ? '#4caf50' : '#666' }}>
            {selection.isTransforming ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Mode</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => selection.setMode(m)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '11px',
                background: selection.mode === m ? '#FF9800' : '#1e1e1e',
                color: selection.mode === m ? '#000' : '#bbb',
                border: '1px solid #333',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: selection.mode === m ? 700 : 400,
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)} ({m === 'translate' ? 'G' : m === 'rotate' ? 'R' : 'S'})
            </button>
          ))}
        </div>
      </div>
      {instanceConfig && (
        <div style={s.section}>
          <h3 style={s.h3}>Instance: {instanceConfig.type} ({instanceConfig.id})</h3>
          <InstanceEditSection inst={instanceConfig} />
        </div>
      )}
      <div style={s.section}>
        <h3 style={s.h3}>Shortcuts</h3>
        <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.6 }}>
          <div><b>F</b> — Toggle free camera (edit mode)</div>
          <div><b>Click</b> — Select object</div>
          <div><b>G</b> — Translate gizmo</div>
          <div><b>R</b> — Rotate gizmo</div>
          <div><b>S</b> — Scale gizmo</div>
          <div><b>Esc</b> — Detach gizmo</div>
        </div>
      </div>
    </div>
  );
}
