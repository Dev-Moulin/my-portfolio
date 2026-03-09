import { useEffect, useRef } from 'react';
import type { useInstanceConfig } from '../../../hooks/useInstanceConfig.ts';
import type {
  NeonInstanceConfig, TextInstanceConfig, LightInstanceConfig, CardInstanceConfig,
} from '../../../scene/instanceRegistry.ts';
import { s } from '../styles.ts';

// ── Types ───────────────────────────────────────────────────────────────────

type InstanceHook = NonNullable<ReturnType<typeof useInstanceConfig>>;

interface EditProps {
  inst: InstanceHook;
  mixedFields?: Set<string>;
}

// ── Mixable helpers ─────────────────────────────────────────────────────────

function MixableSlider({ field, value, isMixed, onChange, min, max, step, label, decimals = 1 }: {
  field: string; value: number; isMixed: boolean;
  onChange: (v: number) => void;
  min: number; max: number; step: number; label: string; decimals?: number;
}) {
  return (
    <div style={s.row}>
      <label style={{ ...s.label, color: isMixed ? '#666' : undefined }}>
        {label}: {isMixed ? '\u2014' : value.toFixed(decimals)}
      </label>
      <input
        style={{ ...s.range, opacity: isMixed ? 0.3 : 1 }}
        type="range" min={min} max={max} step={step}
        value={isMixed ? (min + max) / 2 : value}
        onChange={e => onChange(+e.target.value)}
      />
    </div>
  );
}

function MixableColor({ field, value, isMixed, onChange, label }: {
  field: string; value: string; isMixed: boolean;
  onChange: (v: string) => void; label: string;
}) {
  return (
    <div style={s.row}>
      <label style={{ ...s.label, color: isMixed ? '#666' : undefined }}>
        {label}:
        <input
          style={{ ...s.colorInput, opacity: isMixed ? 0.3 : 1 }}
          type="color"
          value={isMixed ? '#888888' : value}
          onChange={e => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

function MixableCheckbox({ field, checked, isMixed, onChange, label }: {
  field: string; checked: boolean; isMixed: boolean;
  onChange: (v: boolean) => void; label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isMixed;
  }, [isMixed]);

  return (
    <div style={s.row}>
      <label style={{ ...s.checkLabel, color: isMixed ? '#666' : undefined }}>
        <input
          ref={ref}
          type="checkbox"
          checked={isMixed ? false : checked}
          onChange={() => onChange(!checked)}
        />
        {label}
      </label>
    </div>
  );
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function InstanceEditSection({ inst, mixedFields }: EditProps) {
  switch (inst.type) {
    case 'neon': return <NeonInstanceEdit inst={inst} mixedFields={mixedFields} />;
    case 'text': return <TextInstanceEdit inst={inst} mixedFields={mixedFields} />;
    case 'light': return <LightInstanceEdit inst={inst} mixedFields={mixedFields} />;
    case 'card': return <CardInstanceEdit inst={inst} mixedFields={mixedFields} />;
  }
}

// ── Neon Instance ───────────────────────────────────────────────────────────

function NeonInstanceEdit({ inst, mixedFields }: EditProps) {
  const c = inst.config as NeonInstanceConfig;
  const m = (f: string) => mixedFields?.has(f) === true;

  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Position & Scale</h3>
        <MixableSlider field="positionX" value={c.positionX} isMixed={m('positionX')}
          onChange={v => inst.updateField('positionX', v)} min={-15} max={15} step={0.5} label="X" />
        <MixableSlider field="positionY" value={c.positionY} isMixed={m('positionY')}
          onChange={v => inst.updateField('positionY', v)} min={-10} max={10} step={0.5} label="Y" />
        <MixableSlider field="positionZ" value={c.positionZ} isMixed={m('positionZ')}
          onChange={v => inst.updateField('positionZ', v)} min={-20} max={0} step={0.5} label="Z" />
        <MixableSlider field="scale" value={c.scale} isMixed={m('scale')}
          onChange={v => inst.updateField('scale', v)} min={0.1} max={3} step={0.05} label="Scale" decimals={2} />
      </div>

      <div style={s.section}>
        <h3 style={s.h3}>Layout</h3>
        <MixableSlider field="bandSpacing" value={c.bandSpacing} isMixed={m('bandSpacing')}
          onChange={v => inst.updateField('bandSpacing', v)} min={0} max={1} step={0.05} label="Band Spacing" decimals={2} />
        <MixableSlider field="arcRadius" value={c.arcRadius} isMixed={m('arcRadius')}
          onChange={v => inst.updateField('arcRadius', v)} min={2} max={10} step={0.5} label="Arc Radius" />
        <MixableSlider field="depthSpread" value={c.depthSpread} isMixed={m('depthSpread')}
          onChange={v => inst.updateField('depthSpread', v)} min={1} max={8} step={0.1} label="Depth Spread" />
        <MixableSlider field="lineLength" value={c.lineLength} isMixed={m('lineLength')}
          onChange={v => inst.updateField('lineLength', v)} min={5} max={30} step={1} label="Line Length" decimals={0} />
      </div>

      <div style={s.section}>
        <h3 style={s.h3}>Flow</h3>
        <MixableCheckbox field="flowEnabled" checked={c.flowEnabled} isMixed={m('flowEnabled')}
          onChange={v => inst.updateField('flowEnabled', v)} label="Enable Flow" />
        <MixableSlider field="flowSpeed" value={c.flowSpeed} isMixed={m('flowSpeed')}
          onChange={v => inst.updateField('flowSpeed', v)} min={0} max={5} step={0.1} label="Flow Speed" />
        <MixableSlider field="globalIntensity" value={c.globalIntensity} isMixed={m('globalIntensity')}
          onChange={v => inst.updateField('globalIntensity', v)} min={0} max={3} step={0.1} label="Global Intensity" />
      </div>

      {/* Bands: skip in multi-select (too complex for V1) */}
      {!mixedFields && (
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
      )}
    </div>
  );
}

// ── Text Instance ───────────────────────────────────────────────────────────

function TextInstanceEdit({ inst, mixedFields }: EditProps) {
  const c = inst.config as TextInstanceConfig;
  const m = (f: string) => mixedFields?.has(f) === true;

  return (
    <div>
      {!mixedFields && (
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
      )}
      <div style={s.section}>
        <h3 style={s.h3}>Appearance</h3>
        <MixableSlider field="fontSize" value={c.fontSize} isMixed={m('fontSize')}
          onChange={v => inst.updateField('fontSize', v)} min={0.1} max={3} step={0.05} label="Font Size" decimals={2} />
        <MixableColor field="color" value={c.color} isMixed={m('color')}
          onChange={v => inst.updateField('color', v)} label="Color" />
        <MixableSlider field="emissiveIntensity" value={c.emissiveIntensity} isMixed={m('emissiveIntensity')}
          onChange={v => inst.updateField('emissiveIntensity', v)} min={0} max={5} step={0.1} label="Emissive Intensity" />
      </div>
    </div>
  );
}

// ── Light Instance ──────────────────────────────────────────────────────────

function LightInstanceEdit({ inst, mixedFields }: EditProps) {
  const c = inst.config as LightInstanceConfig;
  const m = (f: string) => mixedFields?.has(f) === true;

  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Light Properties</h3>
        {!mixedFields && (
          <div style={s.row}>
            <label style={s.label}>Type: {c.lightType}</label>
          </div>
        )}
        <MixableColor field="color" value={c.color} isMixed={m('color')}
          onChange={v => inst.updateField('color', v)} label="Color" />
        <MixableSlider field="intensity" value={c.intensity} isMixed={m('intensity')}
          onChange={v => inst.updateField('intensity', v)} min={0} max={5} step={0.1} label="Intensity" />
        {c.lightType === 'point' && c.distance !== undefined && (
          <MixableSlider field="distance" value={c.distance} isMixed={m('distance')}
            onChange={v => inst.updateField('distance', v)} min={0} max={100} step={1} label="Distance" decimals={0} />
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Position</h3>
        <MixableSlider field="positionX" value={c.positionX} isMixed={m('positionX')}
          onChange={v => inst.updateField('positionX', v)} min={-10} max={10} step={0.5} label="X" />
        <MixableSlider field="positionY" value={c.positionY} isMixed={m('positionY')}
          onChange={v => inst.updateField('positionY', v)} min={-10} max={10} step={0.5} label="Y" />
        <MixableSlider field="positionZ" value={c.positionZ} isMixed={m('positionZ')}
          onChange={v => inst.updateField('positionZ', v)} min={-10} max={10} step={0.5} label="Z" />
      </div>
    </div>
  );
}

// ── Card Instance ───────────────────────────────────────────────────────────

function CardInstanceEdit({ inst, mixedFields }: EditProps) {
  const c = inst.config as CardInstanceConfig;
  const m = (f: string) => mixedFields?.has(f) === true;

  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Position & Scale</h3>
        <MixableSlider field="positionX" value={c.positionX} isMixed={m('positionX')}
          onChange={v => inst.updateField('positionX', v)} min={-10} max={10} step={0.5} label="X" />
        <MixableSlider field="positionY" value={c.positionY} isMixed={m('positionY')}
          onChange={v => inst.updateField('positionY', v)} min={-10} max={10} step={0.5} label="Y" />
        <MixableSlider field="positionZ" value={c.positionZ} isMixed={m('positionZ')}
          onChange={v => inst.updateField('positionZ', v)} min={-10} max={10} step={0.5} label="Z" />
        <MixableSlider field="scale" value={c.scale} isMixed={m('scale')}
          onChange={v => inst.updateField('scale', v)} min={0.1} max={5} step={0.1} label="Scale" decimals={2} />
      </div>
    </div>
  );
}
