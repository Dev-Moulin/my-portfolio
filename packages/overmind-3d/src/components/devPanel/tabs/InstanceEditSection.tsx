import type { useInstanceConfig } from '../../../hooks/useInstanceConfig.ts';
import type { NeonInstanceConfig, TextInstanceConfig, LightInstanceConfig } from '../../../scene/instanceRegistry.ts';
import { s } from '../styles.ts';

type InstanceHook = NonNullable<ReturnType<typeof useInstanceConfig>>;

export function InstanceEditSection({ inst }: { inst: InstanceHook }) {
  switch (inst.type) {
    case 'neon': return <NeonInstanceEdit inst={inst} />;
    case 'text': return <TextInstanceEdit inst={inst} />;
    case 'light': return <LightInstanceEdit inst={inst} />;
  }
}

// ── Neon Instance ──────────────────────────────────────────────────────────────

function NeonInstanceEdit({ inst }: { inst: InstanceHook }) {
  const c = inst.config as NeonInstanceConfig;
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Position & Scale</h3>
        <div style={s.row}>
          <label style={s.label}>X: {c.positionX.toFixed(1)}</label>
          <input style={s.range} type="range" min="-15" max="15" step="0.5"
            value={c.positionX} onChange={e => inst.updateField('positionX', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Y: {c.positionY.toFixed(1)}</label>
          <input style={s.range} type="range" min="-10" max="10" step="0.5"
            value={c.positionY} onChange={e => inst.updateField('positionY', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Z: {c.positionZ.toFixed(1)}</label>
          <input style={s.range} type="range" min="-20" max="0" step="0.5"
            value={c.positionZ} onChange={e => inst.updateField('positionZ', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Scale: {c.scale.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.1" max="3" step="0.05"
            value={c.scale} onChange={e => inst.updateField('scale', +e.target.value)} />
        </div>
      </div>

      <div style={s.section}>
        <h3 style={s.h3}>Layout</h3>
        <div style={s.row}>
          <label style={s.label}>Band Spacing: {c.bandSpacing.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="1" step="0.05"
            value={c.bandSpacing} onChange={e => inst.updateField('bandSpacing', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Arc Radius: {c.arcRadius.toFixed(1)}</label>
          <input style={s.range} type="range" min="2" max="10" step="0.5"
            value={c.arcRadius} onChange={e => inst.updateField('arcRadius', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Depth Spread: {c.depthSpread.toFixed(1)}</label>
          <input style={s.range} type="range" min="1" max="8" step="0.1"
            value={c.depthSpread} onChange={e => inst.updateField('depthSpread', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Line Length: {c.lineLength.toFixed(0)}</label>
          <input style={s.range} type="range" min="5" max="30" step="1"
            value={c.lineLength} onChange={e => inst.updateField('lineLength', +e.target.value)} />
        </div>
      </div>

      <div style={s.section}>
        <h3 style={s.h3}>Flow</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={c.flowEnabled}
              onChange={() => inst.updateField('flowEnabled', !c.flowEnabled)} />
            Enable Flow
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>Flow Speed: {c.flowSpeed.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={c.flowSpeed} onChange={e => inst.updateField('flowSpeed', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Global Intensity: {c.globalIntensity.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="3" step="0.1"
            value={c.globalIntensity} onChange={e => inst.updateField('globalIntensity', +e.target.value)} />
        </div>
      </div>

      <div style={s.section}>
        <h3 style={s.h3}>Bands ({c.bands.length})</h3>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {c.bands.map((band, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 0', borderBottom: '1px solid #1a1a1a',
            }}>
              <input type="checkbox" checked={band.visible}
                onChange={() => inst.updateBand(i, 'visible', !band.visible)} />
              <input style={s.colorInput} type="color" value={band.color}
                onChange={e => inst.updateBand(i, 'color', e.target.value)} />
              <span style={{ color: '#888', fontSize: '10px', minWidth: '18px' }}>{i}</span>
              <input style={{ ...s.range, flex: 1 }} type="range" min="0.1" max="3" step="0.05"
                value={band.width} title="Width"
                onChange={e => inst.updateBand(i, 'width', +e.target.value)} />
              <span style={{ color: '#555', fontSize: '9px', width: '20px' }}>{band.width.toFixed(1)}</span>
              <input style={{ ...s.range, flex: 1 }} type="range" min="0" max="5" step="0.1"
                value={band.intensity} title="Intensity"
                onChange={e => inst.updateBand(i, 'intensity', +e.target.value)} />
              <span style={{ color: '#555', fontSize: '9px', width: '20px' }}>{band.intensity.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Text Instance ──────────────────────────────────────────────────────────────

function TextInstanceEdit({ inst }: { inst: InstanceHook }) {
  const c = inst.config as TextInstanceConfig;
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Text Content</h3>
        <div style={s.row}>
          <textarea
            value={c.text}
            onChange={e => inst.updateField('text', e.target.value)}
            rows={3}
            style={{
              width: '100%', background: '#222', color: '#ddd',
              border: '1px solid #3a3a3a', borderRadius: '3px',
              padding: '4px 6px', fontSize: '11px', fontFamily: '"Courier New", monospace',
              resize: 'vertical',
            }}
          />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Appearance</h3>
        <div style={s.row}>
          <label style={s.label}>Font Size: {c.fontSize.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.1" max="3" step="0.05"
            value={c.fontSize} onChange={e => inst.updateField('fontSize', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>
            Color:
            <input style={s.colorInput} type="color" value={c.color}
              onChange={e => inst.updateField('color', e.target.value)} />
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>Emissive Intensity: {c.emissiveIntensity.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={c.emissiveIntensity} onChange={e => inst.updateField('emissiveIntensity', +e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ── Light Instance ─────────────────────────────────────────────────────────────

function LightInstanceEdit({ inst }: { inst: InstanceHook }) {
  const c = inst.config as LightInstanceConfig;
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Light Properties</h3>
        <div style={s.row}>
          <label style={s.label}>Type: {c.lightType}</label>
        </div>
        <div style={s.row}>
          <label style={s.label}>
            Color:
            <input style={s.colorInput} type="color" value={c.color}
              onChange={e => inst.updateField('color', e.target.value)} />
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>Intensity: {c.intensity.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={c.intensity} onChange={e => inst.updateField('intensity', +e.target.value)} />
        </div>
        {c.lightType === 'point' && c.distance !== undefined && (
          <div style={s.row}>
            <label style={s.label}>Distance: {c.distance.toFixed(0)}</label>
            <input style={s.range} type="range" min="0" max="100" step="1"
              value={c.distance} onChange={e => inst.updateField('distance', +e.target.value)} />
          </div>
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Position</h3>
        <div style={s.row}>
          <label style={s.label}>X: {c.positionX.toFixed(1)}</label>
          <input style={s.range} type="range" min="-10" max="10" step="0.5"
            value={c.positionX} onChange={e => inst.updateField('positionX', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Y: {c.positionY.toFixed(1)}</label>
          <input style={s.range} type="range" min="-10" max="10" step="0.5"
            value={c.positionY} onChange={e => inst.updateField('positionY', +e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Z: {c.positionZ.toFixed(1)}</label>
          <input style={s.range} type="range" min="-10" max="10" step="0.5"
            value={c.positionZ} onChange={e => inst.updateField('positionZ', +e.target.value)} />
        </div>
      </div>
    </div>
  );
}
