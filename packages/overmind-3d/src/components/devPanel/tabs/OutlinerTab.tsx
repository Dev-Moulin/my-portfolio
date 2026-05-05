import type { useSelection } from '../../../hooks/useSelection.ts';
import type { useInstanceConfig } from '../../../hooks/useInstanceConfig.ts';
import { InstanceEditSection } from './InstanceEditSection.tsx';
import { s } from '../styles.ts';

const MODES = ['translate', 'rotate', 'scale'] as const;

// Known scene objects (static, always first)
const SCENE_OBJECTS = ['model', 'title', 'subtitle', 'card', 'dirLight', 'pointLight'];

interface OutlinerTabProps {
  selection: ReturnType<typeof useSelection>;
  instanceConfig: ReturnType<typeof useInstanceConfig>;
}

export function OutlinerTab({ selection, instanceConfig }: OutlinerTabProps) {
  const sceneIds = selection.registeredIds.filter(id => SCENE_OBJECTS.includes(id));
  const instanceIds = selection.registeredIds.filter(id => !SCENE_OBJECTS.includes(id));

  // Maintain known order for scene objects, append any unknown ones
  const orderedSceneIds = SCENE_OBJECTS.filter(id => sceneIds.includes(id));
  const extraSceneIds = sceneIds.filter(id => !SCENE_OBJECTS.includes(id));

  return (
    <div>
      {/* ── Scene Hierarchy ─────────────────────────────────────── */}
      <div style={s.section}>
        <h3 style={s.h3}>Scene Hierarchy</h3>
        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {[...orderedSceneIds, ...extraSceneIds].map(id => (
            <OutlinerRow
              key={id}
              id={id}
              isSelected={selection.selectedIds.includes(id)}
              isVisible={selection.visibility[id] !== false}
              isLocked={selection.locked[id] === true}
              onSelect={() => handleSelect(id)}
              onToggleVisibility={() => selection.toggleVisibility(id)}
              onToggleLock={() => selection.toggleLocked(id)}
            />
          ))}
          {instanceIds.length > 0 && (
            <>
              <div style={{
                fontSize: '9px', color: '#555', letterSpacing: '1px',
                textTransform: 'uppercase', padding: '6px 0 3px 0',
                borderTop: '1px solid #1c1c1c', marginTop: '4px',
              }}>
                Instances
              </div>
              {instanceIds.map(id => (
                <OutlinerRow
                  key={id}
                  id={id}
                  isSelected={selection.selectedIds.includes(id)}
                  isVisible={selection.visibility[id] !== false}
                  isLocked={selection.locked[id] === true}
                  onSelect={() => handleSelect(id)}
                  onToggleVisibility={() => selection.toggleVisibility(id)}
                  onToggleLock={() => selection.toggleLocked(id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Transform Mode ──────────────────────────────────────── */}
      <div style={s.section}>
        <h3 style={s.h3}>Transform</h3>
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

      {/* ── Instance Edit ───────────────────────────────────────── */}
      {instanceConfig && (
        <div style={s.section}>
          <h3 style={s.h3}>Instance: {instanceConfig.type} ({instanceConfig.id})</h3>
          <InstanceEditSection inst={instanceConfig} />
        </div>
      )}

      {/* ── Shortcuts ───────────────────────────────────────────── */}
      <div style={s.section}>
        <h3 style={s.h3}>Shortcuts</h3>
        <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.6 }}>
          <div><b>F</b> — Toggle free camera (edit mode)</div>
          <div><b>Click</b> — Select object</div>
          <div><b>Ctrl+Click</b> — Multi-select</div>
          <div><b>G</b> — Translate gizmo</div>
          <div><b>R</b> — Rotate gizmo</div>
          <div><b>S</b> — Scale gizmo</div>
          <div><b>Esc</b> — Detach gizmo</div>
          <div><b>A</b> — Select all</div>
          <div><b>Alt+A</b> — Deselect all</div>
          <div><b>Alt+H</b> — Toggle visibility</div>
          <div><b>Alt+L</b> — Toggle lock</div>
          <div><b>Ctrl+M</b> — Mirror</div>
          <div><b>Shift+D</b> — Duplicate</div>
          <div><b>Delete</b> — Delete instance</div>
          <div><b>Ctrl+Z</b> — Undo</div>
          <div><b>Ctrl+Shift+Z</b> — Redo</div>
        </div>
      </div>
    </div>
  );

  function handleSelect(id: string) {
    window.dispatchEvent(new CustomEvent('overmind:outliner-select', { detail: { id } }));
  }
}

// ── Row component ─────────────────────────────────────────────────────────────

function OutlinerRow({
  id, isSelected, isVisible, isLocked, onSelect, onToggleVisibility, onToggleLock,
}: {
  id: string;
  isSelected: boolean;
  isVisible: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 6px',
        borderRadius: '3px',
        cursor: 'pointer',
        background: isSelected ? '#2a3a5a' : 'transparent',
        opacity: isVisible ? 1 : 0.4,
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
        title={isVisible ? 'Hide' : 'Show'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '12px',
          color: isVisible ? '#aaa' : '#444',
          lineHeight: 1,
        }}
      >
        {isVisible ? '\u25C9' : '\u25CB'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        title={isLocked ? 'Unlock' : 'Lock'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '10px',
          color: isLocked ? '#FF9800' : '#444',
          lineHeight: 1,
        }}
      >
        {isLocked ? '\u{1F512}' : '\u{1F513}'}
      </button>
      <span style={{
        flex: 1,
        fontSize: '11px',
        color: isSelected ? '#FF9800' : isLocked ? '#666' : isVisible ? '#ccc' : '#555',
        fontWeight: isSelected ? 600 : 400,
      }}>
        {id}
      </span>
      {isSelected && (
        <span style={{ fontSize: '8px', color: '#FF9800' }}>SEL</span>
      )}
    </div>
  );
}
