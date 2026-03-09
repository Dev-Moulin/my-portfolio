import { useState, useEffect, useCallback } from 'react';

interface Shortcut {
  key: string;
  desc: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: 'Global',
    shortcuts: [
      { key: '?', desc: 'Toggle this overlay' },
      { key: 'F', desc: 'Toggle free / scroll camera' },
      { key: 'Ctrl+S', desc: 'Save scene' },
      { key: 'Ctrl+Z', desc: 'Undo' },
      { key: 'Ctrl+Shift+Z', desc: 'Redo' },
      { key: 'Esc', desc: 'Cancel active operation' },
    ],
  },
  {
    title: 'Object Mode',
    shortcuts: [
      { key: 'G', desc: 'Grab (translate)' },
      { key: 'R', desc: 'Rotate' },
      { key: 'S', desc: 'Scale' },
      { key: 'X/Y/Z', desc: 'Axis constraint (during G/R/S)' },
      { key: 'Ctrl', desc: 'Snap rotation 5\u00b0 (during R)' },
      { key: 'Ctrl+Shift', desc: 'Snap rotation 1\u00b0 (during R)' },
      { key: 'Ctrl+M', desc: 'Mirror' },
      { key: 'Shift+MMB', desc: 'Pan camera' },
      { key: 'I', desc: 'Insert keyframe' },
      { key: 'A', desc: 'Select all' },
      { key: 'Alt+A', desc: 'Deselect all' },
      { key: 'B', desc: 'Box select' },
      { key: 'Ctrl+RMB', desc: 'Lasso select' },
      { key: 'Shift+D', desc: 'Duplicate' },
      { key: 'Del', desc: 'Delete selected' },
      { key: 'T', desc: 'Frame selected (zoom to object)' },
      { key: 'H', desc: 'Home (reset camera)' },
      { key: 'Alt+H', desc: 'Toggle visibility' },
      { key: 'Alt+L', desc: 'Toggle lock' },
    ],
  },
  {
    title: 'Edit Mode (Eye Path)',
    shortcuts: [
      { key: 'E', desc: 'Extrude point' },
      { key: 'W', desc: 'Subdivide segment' },
      { key: 'V', desc: 'Handle type menu' },
      { key: 'G', desc: 'Grab control points' },
      { key: 'R', desc: 'Rotate control points' },
      { key: 'S', desc: 'Scale control points' },
      { key: 'A', desc: 'Select all points' },
      { key: 'Del', desc: 'Delete point(s)' },
      { key: 'Tab', desc: 'Exit edit mode' },
    ],
  },
  {
    title: 'Timeline',
    shortcuts: [
      { key: 'I', desc: 'Insert camera keyframe' },
      { key: 'W', desc: 'Add dwell at cursor' },
      { key: 'P', desc: 'Add eye path point' },
      { key: 'V', desc: 'Capture visual keyframe' },
      { key: 'D', desc: 'Delete hovered keyframe' },
      { key: 'Del / X', desc: 'Delete selected diamonds' },
      { key: 'Ctrl+D', desc: 'Duplicate hovered to cursor' },
      { key: 'Shift+D', desc: 'Duplicate selected to cursor' },
      { key: 'G', desc: 'Grab selected diamonds' },
      { key: 'T', desc: 'Easing menu (selected)' },
      { key: 'Ctrl+C', desc: 'Copy selected diamonds' },
      { key: 'Ctrl+V', desc: 'Paste at cursor' },
      { key: 'Home', desc: 'Reset zoom' },
      { key: 'Scroll', desc: 'Zoom in/out' },
      { key: 'MMB drag', desc: 'Pan timeline' },
      { key: 'Ctrl (drag)', desc: 'Snap to neighbors' },
    ],
  },
];

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.88)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '"Courier New", monospace',
};

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '24px 40px',
  maxWidth: '800px',
  maxHeight: '80vh',
  overflowY: 'auto',
  padding: '32px',
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#4FC3F7',
  marginBottom: '8px',
  borderBottom: '1px solid #333',
  paddingBottom: '4px',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '2px 0',
  fontSize: '11px',
};

const KBD: React.CSSProperties = {
  display: 'inline-block',
  background: '#222',
  border: '1px solid #444',
  borderRadius: '3px',
  padding: '1px 5px',
  fontSize: '10px',
  fontFamily: 'inherit',
  color: '#eee',
  minWidth: '20px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

export function ShortcutsOverlay() {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => setVisible(v => !v), []);

  useEffect(() => {
    window.addEventListener('overmind:toggle-shortcuts', toggle);
    return () => window.removeEventListener('overmind:toggle-shortcuts', toggle);
  }, [toggle]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        setVisible(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={OVERLAY} onClick={() => setVisible(false)}>
      <div onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', color: '#888', fontSize: '14px', marginBottom: '16px', fontFamily: '"Courier New", monospace' }}>
          Keyboard Shortcuts &mdash; press <span style={KBD}>?</span> or <span style={KBD}>Esc</span> to close
        </div>
        <div style={GRID}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div style={SECTION_TITLE}>{section.title}</div>
              {section.shortcuts.map((sc) => (
                <div key={sc.key + sc.desc} style={ROW}>
                  <span style={KBD}>{sc.key}</span>
                  <span style={{ color: '#aaa' }}>{sc.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
