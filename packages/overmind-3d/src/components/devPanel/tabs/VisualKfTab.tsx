import { useRef } from 'react';
import type { useBloom } from '../../../hooks/useBloom.ts';
import type { useLighting } from '../../../hooks/useLighting.ts';
import type { useMaterial } from '../../../hooks/useMaterial.ts';
import type { useScene } from '../../../hooks/useScene.ts';
import type { useNeonBands } from '../../../hooks/useNeonBands.ts';
import type { useTimeline } from '../../../hooks/useTimeline.ts';
import type { VisualKeyframe } from '../../../machines/timelineMachine.ts';
import { EASING_OPTIONS } from '../../../utils/easing.ts';
import { s } from '../styles.ts';

const numInput: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #333', borderRadius: '3px',
  color: '#fff', fontSize: '10px', padding: '2px 4px', fontFamily: 'inherit',
};

interface VisualKfTabProps {
  bloom: ReturnType<typeof useBloom>;
  lighting: ReturnType<typeof useLighting>;
  material: ReturnType<typeof useMaterial>;
  scene: ReturnType<typeof useScene>;
  neon: ReturnType<typeof useNeonBands>;
  timeline: ReturnType<typeof useTimeline>;
}

export function VisualKfTab({ bloom, lighting, material, scene, neon, timeline }: VisualKfTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function captureVisualKeyframe() {
    const kf: VisualKeyframe = {
      at: Math.round(timeline.currentFrame),
      duration: 30,
      enterDuration: 5,
      exitDuration: 5,
      easing: 'smoothstep',
      label: `V${timeline.visualKeyframes.length + 1}`,
      bloom: {
        enabled: bloom.enabled,
        color: bloom.bloomColor,
        strength: bloom.strength,
        threshold: bloom.threshold,
        radius: bloom.radius,
      },
      lighting: {
        ambientIntensity: lighting.ambientIntensity,
        directionalIntensity: lighting.directionalIntensity,
        pointIntensity: lighting.pointIntensity,
        exposure: lighting.exposure,
        hdrBoostEnabled: lighting.hdrBoostEnabled,
        hdrBoostMultiplier: lighting.hdrBoostMultiplier,
      },
      material: {
        iris: { emissiveColor: material.iris.emissiveColor, emissiveIntensity: material.iris.emissiveIntensity },
        eyeRings: { emissiveColor: material.eyeRings.emissiveColor, emissiveIntensity: material.eyeRings.emissiveIntensity },
        revealRings: { emissiveColor: material.revealRings.emissiveColor, emissiveIntensity: material.revealRings.emissiveIntensity },
      },
      scene: { backgroundColor: scene.backgroundColor },
      neon: {
        flowSpeed: neon.flowSpeed,
        flowEnabled: neon.flowEnabled,
        globalIntensity: neon.globalIntensity,
      },
    };
    timeline.addVisualKeyframe(kf);
  }

  function exportVisualKeyframes() {
    const json = JSON.stringify({ visualKeyframes: timeline.visualKeyframes }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'visual-keyframes.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importVisualKeyframes(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.visualKeyframes) {
          timeline.importVisualKeyframes(data.visualKeyframes);
        }
      } catch { /* ignore invalid JSON */ }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Visual Keyframes</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={timeline.visualEnabled}
              onChange={(e) => timeline.setVisualEnabled(e.target.checked)} />
            Enable Visual Track
          </label>
        </div>
        <div style={{ ...s.row, gap: '4px' }}>
          <button style={s.btnReset} onClick={captureVisualKeyframe}>
            Capture at frame {Math.round(timeline.currentFrame)}
          </button>
          <button style={s.btnReset} onClick={exportVisualKeyframes}>Export</button>
          <button style={s.btnReset} onClick={() => fileInputRef.current?.click()}>Import</button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importVisualKeyframes(f); }} />
        </div>
      </div>

      {timeline.visualKeyframes.length > 0 && (
        <div style={s.section}>
          <h3 style={s.h3}>Clips ({timeline.visualKeyframes.length})</h3>
          {timeline.visualKeyframes.map((vkf, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <input
                  style={{ ...numInput, width: '90px', fontSize: '9px' }}
                  value={vkf.label || ''}
                  onChange={(e) => timeline.updateVisualKeyframe(i, { ...vkf, label: e.target.value })}
                  placeholder="Label"
                />
                <span style={{ color: '#666', fontSize: '9px' }}>
                  @{Math.round(vkf.at)} dur:{Math.round(vkf.duration)}
                </span>
                <button
                  style={{ ...s.btnReset, padding: '1px 4px', fontSize: '9px', color: '#f44' }}
                  onClick={() => timeline.deleteVisualKeyframe(i)}
                >x</button>
              </div>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '8px', color: '#666' }}>at:
                  <input type="number" style={{ ...numInput, width: '40px' }}
                    value={Math.round(vkf.at)}
                    onChange={(e) => timeline.updateVisualKeyframe(i, { ...vkf, at: +e.target.value })} />
                </label>
                <label style={{ fontSize: '8px', color: '#666' }}>dur:
                  <input type="number" style={{ ...numInput, width: '40px' }}
                    value={Math.round(vkf.duration)}
                    onChange={(e) => timeline.updateVisualKeyframe(i, { ...vkf, duration: Math.max(1, +e.target.value) })} />
                </label>
                <label style={{ fontSize: '8px', color: '#666' }}>in:
                  <input type="number" style={{ ...numInput, width: '35px' }}
                    value={Math.round(vkf.enterDuration)}
                    onChange={(e) => timeline.updateVisualKeyframe(i, { ...vkf, enterDuration: Math.max(0, +e.target.value) })} />
                </label>
                <label style={{ fontSize: '8px', color: '#666' }}>out:
                  <input type="number" style={{ ...numInput, width: '35px' }}
                    value={Math.round(vkf.exitDuration)}
                    onChange={(e) => timeline.updateVisualKeyframe(i, { ...vkf, exitDuration: Math.max(0, +e.target.value) })} />
                </label>
                <select
                  style={{ ...numInput, width: '80px', fontSize: '8px' }}
                  value={vkf.easing}
                  onChange={(e) => timeline.updateVisualKeyframe(i, { ...vkf, easing: e.target.value as typeof vkf.easing })}
                >
                  {EASING_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>
                bloom: {vkf.bloom.color} s:{vkf.bloom.strength.toFixed(1)} | bg: {vkf.scene.backgroundColor}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
