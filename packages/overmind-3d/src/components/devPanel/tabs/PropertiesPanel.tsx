import { useState } from 'react';
import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { useSelection } from '../../../hooks/useSelection.ts';
import type { useInstanceConfig } from '../../../hooks/useInstanceConfig.ts';
import type { MultiInstanceConfigState } from '../../../hooks/useMultiInstanceConfig.ts';
import type { timelineMachine } from '../../../machines/timelineMachine.ts';
import { DESCRIPTOR_META } from '../../../scene/descriptors/index.ts';
import { InstanceEditSection } from './InstanceEditSection.tsx';
import { s } from '../styles.ts';

type TimelineActorRef = ActorRefFrom<typeof timelineMachine>;

// ── Constants ───────────────────────────────────────────────────────────────

const SCENE_OBJECTS = ['model', 'neon', 'title', 'subtitle', 'card', 'dirLight', 'pointLight'];

const MODES = ['translate', 'rotate', 'scale'] as const;

/** Map scene object IDs → which Dev Panel tab has their settings */
const SCENE_OBJECT_TABS: Record<string, string> = {
  model: 'Model',
  neon: 'Neon',
  title: 'ScrollText',
  subtitle: 'ScrollText',
  card: 'Scene',
  dirLight: 'Lighting',
  pointLight: 'Lighting',
};

// ── Props ───────────────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  selection: ReturnType<typeof useSelection>;
  instanceConfig: ReturnType<typeof useInstanceConfig>;
  multiInstanceConfig: MultiInstanceConfigState | null;
  timelineActor: TimelineActorRef;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PropertiesPanel({ selection, instanceConfig, multiInstanceConfig, timelineActor }: PropertiesPanelProps) {
  const count = selection.selectedIds.length;
  const titleDisplayName = useSelector(timelineActor, (s) => s.context.titleDisplayName);
  const subtitleDisplayName = useSelector(timelineActor, (s) => s.context.subtitleDisplayName);
  const displayNames: Record<string, string> = { title: titleDisplayName, subtitle: subtitleDisplayName };

  return (
    <div>
      <SceneHierarchy selection={selection} displayNames={displayNames} />
      {count === 0 && <EmptyState selection={selection} />}
      {count === 1 && (
        <SingleObjectProps
          id={selection.selectedIds[0]}
          selection={selection}
          instanceConfig={instanceConfig}
          timelineActor={timelineActor}
          displayNames={displayNames}
        />
      )}
      {count > 1 && (
        <MultiSelectProps
          selection={selection}
          multiInstanceConfig={multiInstanceConfig}
        />
      )}
    </div>
  );
}

// ── Scene Hierarchy (collapsible) ───────────────────────────────────────────

function SceneHierarchy({ selection, displayNames }: { selection: ReturnType<typeof useSelection>; displayNames: Record<string, string> }) {
  const sceneIds = selection.registeredIds.filter(id => SCENE_OBJECTS.includes(id));
  const instanceIds = selection.registeredIds.filter(id =>
    !SCENE_OBJECTS.includes(id) && !id.startsWith('eyePath:') && !id.startsWith('eyeHandle:')
  );

  const orderedSceneIds = SCENE_OBJECTS.filter(id => sceneIds.includes(id));
  const extraSceneIds = sceneIds.filter(id => !SCENE_OBJECTS.includes(id));

  return (
    <details open style={{ ...s.section, padding: '0' }}>
      <summary style={{
        padding: '7px 10px',
        fontSize: '9px',
        color: '#777',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        cursor: 'pointer',
        userSelect: 'none',
        borderBottom: '1px solid #1c1c1c',
      }}>
        Scene Hierarchy
      </summary>
      <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px 6px' }}>
        {[...orderedSceneIds, ...extraSceneIds].map(id => (
          <OutlinerRow
            key={id}
            id={id}
            customName={displayNames[id]}
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
    </details>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ selection }: { selection: ReturnType<typeof useSelection> }) {
  // Count instances by type
  const instanceIds = selection.registeredIds.filter(id =>
    !SCENE_OBJECTS.includes(id) && !id.startsWith('eyePath:') && !id.startsWith('eyeHandle:')
  );
  const typeCounts: Record<string, number> = {};
  for (const id of instanceIds) {
    const type = id.replace(/_\d+$/, '');
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Scene Overview</h3>
        <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.8 }}>
          <div>Objects: {selection.registeredIds.length}</div>
          {Object.entries(typeCounts).map(([type, count]) => {
            const meta = DESCRIPTOR_META[type];
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: meta?.trackColor ?? '#666', flexShrink: 0,
                }} />
                <span>{meta?.displayName ?? type}: {count}</span>
              </div>
            );
          })}
        </div>
      </div>

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
}

// ── Single Object Properties ────────────────────────────────────────────────

function SingleObjectProps({ id, selection, instanceConfig, timelineActor, displayNames }: {
  id: string;
  selection: ReturnType<typeof useSelection>;
  instanceConfig: ReturnType<typeof useInstanceConfig>;
  timelineActor: TimelineActorRef;
  displayNames: Record<string, string>;
}) {
  const isInstance = instanceConfig !== null;
  const meta = resolveType(id);
  const customName = displayNames[id];

  return (
    <div>
      {/* Header */}
      <div style={{
        ...s.section,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        {meta && (
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: meta.color, flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: '12px', color: '#ddd', fontWeight: 600 }}>
          {customName ?? meta?.displayName ?? id}
        </span>
        <span style={{ fontSize: '10px', color: '#555', marginLeft: 'auto' }}>{id}</span>
      </div>

      {/* Transform */}
      <TransformSection selection={selection} />

      {/* Instance properties */}
      {isInstance && (
        <div style={s.section}>
          <h3 style={s.h3}>{meta?.displayName ?? instanceConfig.type} Properties</h3>
          <InstanceEditSection inst={instanceConfig} />
        </div>
      )}

      {/* Follow Path — only for instances when eye path has points */}
      {isInstance && (
        <FollowPathSection instanceId={id} timelineActor={timelineActor} />
      )}

      {/* Text properties (title / subtitle) */}
      {(id === 'title' || id === 'subtitle') && (
        <TextPropertiesSection objectId={id} timelineActor={timelineActor} />
      )}

      {/* Scene object hint (skip for title/subtitle since we show inline properties) */}
      {!isInstance && SCENE_OBJECT_TABS[id] && id !== 'title' && id !== 'subtitle' && (
        <div style={{ ...s.section, ...s.infoBox }}>
          See <b>{SCENE_OBJECT_TABS[id]}</b> tab for detailed settings.
        </div>
      )}
    </div>
  );
}

// ── Multi-Selection Properties ──────────────────────────────────────────────

function MultiSelectProps({ selection, multiInstanceConfig }: {
  selection: ReturnType<typeof useSelection>;
  multiInstanceConfig: MultiInstanceConfigState | null;
}) {
  const count = selection.selectedIds.length;

  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const id of selection.selectedIds) {
    const type = resolveType(id)?.displayName ?? id.replace(/_\d+$/, '');
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  return (
    <div>
      {/* Summary */}
      <div style={s.section}>
        <h3 style={s.h3}>Selection ({count})</h3>
        <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.8 }}>
          {Object.entries(typeCounts).map(([type, cnt]) => (
            <div key={type}>{cnt} {type}</div>
          ))}
        </div>
      </div>

      {/* Transform */}
      <TransformSection selection={selection} />

      {/* Same-type multi-edit */}
      {multiInstanceConfig && multiInstanceConfig.commonType && multiInstanceConfig.mergedConfig && (
        <div style={s.section}>
          <h3 style={s.h3}>
            {DESCRIPTOR_META[multiInstanceConfig.commonType]?.displayName ?? multiInstanceConfig.commonType} Properties
          </h3>
          <InstanceEditSection
            inst={{
              id: multiInstanceConfig.instances[0].id,
              type: multiInstanceConfig.commonType,
              config: multiInstanceConfig.mergedConfig as any,
              updateField: multiInstanceConfig.updateAll,
              updateBand: () => {},  // Bands not supported in multi-select
            }}
            mixedFields={multiInstanceConfig.mixedFields}
          />
        </div>
      )}

      {/* Mixed-type info */}
      {multiInstanceConfig && !multiInstanceConfig.commonType && (
        <div style={{ ...s.section, ...s.infoBox }}>
          Mixed types selected. Only transform operations are available.
        </div>
      )}
    </div>
  );
}

// ── Transform Section ───────────────────────────────────────────────────────

function TransformSection({ selection }: { selection: ReturnType<typeof useSelection> }) {
  return (
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
  );
}

// ── OutlinerRow ─────────────────────────────────────────────────────────────

function OutlinerRow({
  id, customName, isSelected, isVisible, isLocked, onSelect, onToggleVisibility, onToggleLock,
}: {
  id: string;
  customName?: string;
  isSelected: boolean;
  isVisible: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
}) {
  const meta = resolveType(id);

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
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 2px', fontSize: '12px',
          color: isVisible ? '#aaa' : '#444', lineHeight: 1,
        }}
      >
        {isVisible ? '\u25C9' : '\u25CB'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        title={isLocked ? 'Unlock' : 'Lock'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 2px', fontSize: '10px',
          color: isLocked ? '#FF9800' : '#444', lineHeight: 1,
        }}
      >
        {isLocked ? '\u{1F512}' : '\u{1F513}'}
      </button>
      {meta && (
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: meta.color, flexShrink: 0,
        }} />
      )}
      <span style={{
        flex: 1, fontSize: '11px',
        color: isSelected ? '#FF9800' : isLocked ? '#666' : isVisible ? '#ccc' : '#555',
        fontWeight: isSelected ? 600 : 400,
      }}>
        {customName ?? (meta?.displayName && !SCENE_OBJECTS.includes(id)
          ? `${meta.displayName} (${id})`
          : id)}
      </span>
      {isSelected && (
        <span style={{ fontSize: '8px', color: '#FF9800' }}>SEL</span>
      )}
    </div>
  );
}

// ── Follow Path Section ──────────────────────────────────────────────────────

function FollowPathSection({ instanceId, timelineActor }: {
  instanceId: string;
  timelineActor: TimelineActorRef;
}) {
  const eyePathPointCount = useSelector(timelineActor, (s) => s.context.eyePath.points.length);
  const followPathAssignments = useSelector(timelineActor, (s) => s.context.followPathAssignments);

  if (eyePathPointCount < 2) return null;

  const assignment = followPathAssignments.find(a => a.instanceId === instanceId);
  const isAssigned = !!assignment;

  const handleToggle = () => {
    if (isAssigned) {
      timelineActor.send({ type: 'UNASSIGN_FOLLOW_PATH', instanceId });
    } else {
      timelineActor.send({
        type: 'ASSIGN_FOLLOW_PATH',
        assignment: { instanceId, frameOffset: 0, influence: 1.0, followTangent: true },
      });
    }
  };

  return (
    <div style={s.section}>
      <h3 style={s.h3}>Follow Path</h3>
      <label style={s.checkLabel}>
        <input type="checkbox" checked={isAssigned} onChange={handleToggle} />
        Follow Eye Path
      </label>
      {isAssigned && (
        <div style={{ marginTop: '6px' }}>
          <div style={s.row}>
            <label style={s.label}>Frame Offset ({assignment.frameOffset})</label>
            <input
              type="range" min={-50} max={50} step={1}
              value={assignment.frameOffset}
              onChange={(e) => timelineActor.send({
                type: 'UPDATE_FOLLOW_PATH', instanceId, patch: { frameOffset: +e.target.value },
              })}
              style={s.range}
            />
          </div>
          <div style={s.row}>
            <label style={s.label}>Influence ({assignment.influence.toFixed(2)})</label>
            <input
              type="range" min={0} max={1} step={0.01}
              value={assignment.influence}
              onChange={(e) => timelineActor.send({
                type: 'UPDATE_FOLLOW_PATH', instanceId, patch: { influence: +e.target.value },
              })}
              style={s.range}
            />
          </div>
          <label style={s.checkLabel}>
            <input
              type="checkbox"
              checked={assignment.followTangent}
              onChange={(e) => timelineActor.send({
                type: 'UPDATE_FOLLOW_PATH', instanceId, patch: { followTangent: e.target.checked },
              })}
            />
            Follow Tangent
          </label>
        </div>
      )}
    </div>
  );
}

// ── Text Properties Section ──────────────────────────────────────────────────

function TextPropertiesSection({ objectId, timelineActor }: {
  objectId: 'title' | 'subtitle';
  timelineActor: TimelineActorRef;
}) {
  const isTitle = objectId === 'title';

  const displayName = useSelector(timelineActor, (s) =>
    isTitle ? s.context.titleDisplayName : s.context.subtitleDisplayName
  );
  const text = useSelector(timelineActor, (s) =>
    isTitle ? s.context.titleText : s.context.subtitleText
  );
  const color = useSelector(timelineActor, (s) =>
    isTitle ? s.context.titleColor : s.context.subtitleColor
  );
  const emissive = useSelector(timelineActor, (s) =>
    isTitle ? s.context.titleEmissiveIntensity : s.context.subtitleEmissiveIntensity
  );
  const fontSize = useSelector(timelineActor, (s) =>
    isTitle ? s.context.titleFontSize : s.context.subtitleFontSize
  );

  // Rename state (local editing buffer, committed on Enter/OK)
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState<string>(displayName);

  const commitRename = () => {
    const trimmed = nameVal.trim() || objectId;
    timelineActor.send({
      type: isTitle ? 'SET_TITLE_DISPLAY_NAME' : 'SET_SUBTITLE_DISPLAY_NAME',
      name: trimmed,
    });
    setNameVal(trimmed);
    setRenaming(false);
  };

  const setText = (v: string) => {
    timelineActor.send({ type: isTitle ? 'SET_TITLE_TEXT' : 'SET_SUBTITLE_TEXT', text: v });
  };
  const setColor = (v: string) => {
    timelineActor.send({ type: isTitle ? 'SET_TITLE_COLOR' : 'SET_SUBTITLE_COLOR', color: v });
  };
  const setEmissive = (v: number) => {
    timelineActor.send({ type: isTitle ? 'SET_TITLE_EMISSIVE' : 'SET_SUBTITLE_EMISSIVE', intensity: v });
  };
  const setFontSize = (v: number) => {
    timelineActor.send({ type: isTitle ? 'SET_TITLE_FONT_SIZE' : 'SET_SUBTITLE_FONT_SIZE', size: v });
  };

  return (
    <div style={s.section}>
      <h3 style={s.h3}>Text Properties</h3>

      {/* Rename */}
      <div style={s.row}>
        <label style={s.label}>Name</label>
        {renaming ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); }}
              autoFocus
              style={{ ...s.select, flex: 1 }}
            />
            <button style={s.btnSm} onClick={commitRename}>OK</button>
          </div>
        ) : (
          <div
            style={{ ...s.select, cursor: 'pointer', padding: '4px 6px' }}
            onClick={() => { setNameVal(displayName); setRenaming(true); }}
            title="Click to rename"
          >
            {displayName}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={s.row}>
        <label style={s.label}>Content</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{
            ...s.select,
            resize: 'vertical',
            minHeight: '40px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Color */}
      <div style={s.row}>
        <label style={s.label}>
          Color
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={s.colorInput}
          />
        </label>
      </div>

      {/* Font Size */}
      <div style={s.row}>
        <label style={s.label}>Font Size ({fontSize.toFixed(2)})</label>
        <input
          type="range" min={0.1} max={3} step={0.05}
          value={fontSize}
          onChange={(e) => setFontSize(+e.target.value)}
          style={s.range}
        />
      </div>

      {/* Emissive Intensity */}
      <div style={s.row}>
        <label style={s.label}>Emissive ({emissive.toFixed(2)})</label>
        <input
          type="range" min={0} max={5} step={0.1}
          value={emissive}
          onChange={(e) => setEmissive(+e.target.value)}
          style={s.range}
        />
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function handleSelect(id: string) {
  window.dispatchEvent(new CustomEvent('overmind:outliner-select', { detail: { id } }));
}

/** Resolve display info for an object ID */
function resolveType(id: string): { displayName: string; color: string } | null {
  // Scene object type resolution
  const sceneMap: Record<string, string> = {
    model: 'model', neon: 'neon', title: 'text', subtitle: 'text',
    card: 'card', dirLight: 'light', pointLight: 'light',
  };
  const sceneType = sceneMap[id];
  if (sceneType) {
    const meta = DESCRIPTOR_META[sceneType];
    return meta ? { displayName: id, color: meta.trackColor } : null;
  }

  // Instance ID: extract type from 'type_N' pattern
  const idx = id.lastIndexOf('_');
  if (idx > 0) {
    const type = id.substring(0, idx);
    const meta = DESCRIPTOR_META[type];
    if (meta) return { displayName: meta.displayName, color: meta.trackColor };
  }

  return null;
}
