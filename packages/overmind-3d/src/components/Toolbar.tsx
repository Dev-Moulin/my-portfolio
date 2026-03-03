import { useState, useEffect, useCallback } from 'react';
import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { selectionMachine } from '../machines/selectionMachine.ts';
import type { interactionModeMachine } from '../machines/interactionModeMachine.ts';

// ── Keyboard simulation helper ──────────────────────────────────────────────

function simulateKey(key: string, mods: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
}

// ── Sub-components ──────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  borderRadius: '3px',
  padding: '1px 5px',
  fontSize: '9px',
  fontFamily: 'monospace',
  cursor: 'pointer',
  minWidth: '22px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.12s, border-color 0.12s',
  lineHeight: 1,
};

function Btn({ label, tooltip, active, disabled, onClick }: {
  label: string; tooltip: string; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      title={tooltip}
      style={{
        ...btnBase,
        background: active ? '#3b82f6' : 'none',
        color: active ? '#fff' : disabled ? '#444' : '#999',
        border: '1px solid ' + (active ? '#60a5fa' : '#333'),
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <div style={{ width: '1px', height: '14px', background: '#333', margin: '0 3px' }} />;
}

// ── Toolbar component (inline, embeddable) ──────────────────────────────────

export interface ToolbarProps {
  selectionActor: ActorRefFrom<typeof selectionMachine>;
  interactionModeActor?: ActorRefFrom<typeof interactionModeMachine> | null;
}

export function Toolbar({ selectionActor, interactionModeActor }: ToolbarProps) {
  // Camera mode state from custom event
  const [freeCamera, setFreeCamera] = useState(false);

  // Undo/redo state from custom event
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const onCameraMode = (e: Event) => {
      setFreeCamera((e as CustomEvent<'free' | 'scroll'>).detail === 'free');
    };
    const onUndoState = (e: Event) => {
      const d = (e as CustomEvent<{ canUndo: boolean; canRedo: boolean }>).detail;
      setCanUndo(d.canUndo);
      setCanRedo(d.canRedo);
    };
    window.addEventListener('overmind:camera-mode', onCameraMode);
    window.addEventListener('overmind:undo-state', onUndoState);
    return () => {
      window.removeEventListener('overmind:camera-mode', onCameraMode);
      window.removeEventListener('overmind:undo-state', onUndoState);
    };
  }, []);

  // Selection state from XState
  const selectedIds = useSelector(selectionActor, (s) => s.context.selectedIds);
  const hasSelection = selectedIds.length > 0;
  const gizmoMode = useSelector(selectionActor, (s) => s.context.mode);

  // Mode state from interactionModeMachine
  const mode = useSelector(interactionModeActor ?? undefined, (s) => s?.value ?? 'object');
  const editTargetType = useSelector(interactionModeActor ?? undefined, (s) => s?.context.editTargetType ?? null);
  const isEditMode = mode === 'edit';

  // Actions (simulate keyboard events)
  const toggleCamera = useCallback(() => simulateKey('f'), []);
  const frameSelected = useCallback(() => simulateKey('t'), []);
  const goHome = useCallback(() => simulateKey('h'), []);
  const setTranslate = useCallback(() => simulateKey('g'), []);
  const setRotate = useCallback(() => simulateKey('r'), []);
  const setScale = useCallback(() => simulateKey('s'), []);
  const captureKeyframe = useCallback(() => simulateKey('i'), []);
  const captureEyeWP = useCallback(() => simulateKey('e'), []);
  const captureVisualKF = useCallback(() => simulateKey('v'), []);
  const toggleCurveEdit = useCallback(() => simulateKey('C', { shiftKey: true }), []);
  const duplicate = useCallback(() => simulateKey('D', { shiftKey: true }), []);
  const deleteInstance = useCallback(() => simulateKey('Delete'), []);
  const undo = useCallback(() => simulateKey('z', { ctrlKey: true }), []);
  const redo = useCallback(() => simulateKey('Z', { ctrlKey: true, shiftKey: true }), []);
  const toggleTab = useCallback(() => simulateKey('Tab'), []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {/* Mode badge */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTab(); }}
        title="Toggle mode (Tab)"
        style={{
          ...btnBase,
          fontSize: '8px',
          padding: '1px 6px',
          fontWeight: 600,
          background: isEditMode ? '#f59e0b33' : '#33333366',
          color: isEditMode ? '#fbbf24' : '#666',
          border: `1px solid ${isEditMode ? '#f59e0b55' : '#333'}`,
        }}
      >
        {isEditMode ? `EDIT${editTargetType ? ` (${editTargetType})` : ''}` : 'OBJ'}
      </button>

      <Sep />

      {/* Camera */}
      <Btn label="F" tooltip="Free Camera (F)" active={freeCamera} onClick={toggleCamera} />

      {/* Navigation — free camera only */}
      {freeCamera && (
        <>
          <Btn label="T" tooltip="Frame Selected (T)" disabled={!hasSelection} onClick={frameSelected} />
          <Btn label="H" tooltip="Home (H)" onClick={goHome} />
        </>
      )}

      <Sep />

      {/* Transform */}
      <Btn label="G" tooltip="Move (G)" active={hasSelection && gizmoMode === 'translate'} disabled={!hasSelection} onClick={setTranslate} />
      <Btn label="R" tooltip="Rotate (R)" active={hasSelection && gizmoMode === 'rotate'} disabled={!hasSelection} onClick={setRotate} />
      <Btn label="S" tooltip="Scale (S)" active={hasSelection && gizmoMode === 'scale'} disabled={!hasSelection} onClick={setScale} />

      <Sep />

      {/* Capture */}
      <Btn label="I" tooltip="Keyframe (I)" onClick={captureKeyframe} />
      <Btn label="E" tooltip={isEditMode ? 'Extrude (E)' : 'Eye Waypoint (E)'} onClick={captureEyeWP} />
      <Btn label="V" tooltip="Visual KF (V)" onClick={captureVisualKF} />
      <Btn label="⇧C" tooltip="Curve Edit (Shift+C)" active={isEditMode} onClick={toggleCurveEdit} />

      <Sep />

      {/* Scene */}
      <Btn label="⇧D" tooltip="Duplicate (Shift+D)" disabled={!hasSelection} onClick={duplicate} />
      <Btn label="✕" tooltip="Delete (Del)" disabled={!hasSelection} onClick={deleteInstance} />

      <Sep />

      {/* History */}
      <Btn label="↩" tooltip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
      <Btn label="↪" tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} />
    </div>
  );
}
