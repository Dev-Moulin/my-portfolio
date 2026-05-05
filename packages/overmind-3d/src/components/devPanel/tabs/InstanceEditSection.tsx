import { useEffect, useRef } from 'react';
import type { useInstanceConfig } from '../../../hooks/useInstanceConfig.ts';
import type {
  TextInstanceConfig, LightInstanceConfig, CardInstanceConfig,
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
    case 'text': return <TextInstanceEdit inst={inst} mixedFields={mixedFields} />;
    case 'light': return <LightInstanceEdit inst={inst} mixedFields={mixedFields} />;
    case 'card': return <CardInstanceEdit inst={inst} mixedFields={mixedFields} />;
  }
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
            <label style={s.label}>Type:
              <select
                value={c.lightType}
                onChange={e => inst.updateField('lightType', e.target.value)}
                style={{ marginLeft: 6, background: '#222', color: '#ddd', border: '1px solid #3a3a3a', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}
              >
                <option value="point">Point</option>
                <option value="directional">Directional</option>
                <option value="spot">Spot</option>
                <option value="area">Area</option>
              </select>
            </label>
          </div>
        )}
        <MixableColor field="color" value={c.color} isMixed={m('color')}
          onChange={v => inst.updateField('color', v)} label="Color" />
        <MixableSlider field="intensity" value={c.intensity} isMixed={m('intensity')}
          onChange={v => inst.updateField('intensity', v)} min={0} max={20} step={0.5} label="Intensity" />
        <div style={s.row}>
          <label style={s.label}>Power (W):</label>
          <input type="number" min="0" step="1"
            value={c.power ?? Math.round(c.intensity * 4 * Math.PI)}
            onChange={(e) => inst.updateField('power', Math.max(0, +e.target.value))}
            style={{ width: 70, background: '#1a1a1a', color: '#ddd', border: '1px solid #3a3a3a', borderRadius: 3, padding: '2px 6px', fontSize: 11, marginLeft: 6 }} />
        </div>

        {/* Point + Spot: distance */}
        {(c.lightType === 'point' || c.lightType === 'spot') && (
          <MixableSlider field="distance" value={c.distance ?? 0} isMixed={m('distance')}
            onChange={v => inst.updateField('distance', v)} min={0} max={100} step={1} label="Distance (0=∞)" decimals={0} />
        )}

        {/* Point + Spot: decay */}
        {(c.lightType === 'point' || c.lightType === 'spot') && (
          <MixableSlider field="decay" value={c.decay ?? 2} isMixed={m('decay')}
            onChange={v => inst.updateField('decay', v)} min={0} max={3} step={0.5} label="Decay" />
        )}

        {/* Spot only */}
        {c.lightType === 'spot' && (<>
          <MixableSlider field="angle" value={(c.angle ?? Math.PI / 6) * 180 / Math.PI} isMixed={m('angle')}
            onChange={v => inst.updateField('angle', v * Math.PI / 180)} min={1} max={90} step={1} label="Angle (°)" decimals={0} />
          <MixableSlider field="penumbra" value={c.penumbra ?? 0.3} isMixed={m('penumbra')}
            onChange={v => inst.updateField('penumbra', v)} min={0} max={1} step={0.05} label="Penumbra" decimals={2} />
          <MixableSlider field="decay" value={c.decay ?? 2} isMixed={m('decay')}
            onChange={v => inst.updateField('decay', v)} min={0} max={5} step={0.1} label="Decay" />
          <MixableCheckbox field="volumetric" checked={c.volumetric ?? false} isMixed={m('volumetric')}
            onChange={v => inst.updateField('volumetric', v)} label="Volumetric" />
        </>)}

        {/* Area only */}
        {c.lightType === 'area' && (<>
          <MixableSlider field="areaWidth" value={c.areaWidth ?? 2} isMixed={m('areaWidth')}
            onChange={v => inst.updateField('areaWidth', v)} min={0.1} max={200} step={0.5} label="Width" />
          <MixableSlider field="areaHeight" value={c.areaHeight ?? 2} isMixed={m('areaHeight')}
            onChange={v => inst.updateField('areaHeight', v)} min={0.1} max={200} step={0.5} label="Height" />
        </>)}
      </div>

      {/* Spot + Directional: rotation */}
      {(c.lightType === 'spot' || c.lightType === 'directional') && (
        <div style={s.section}>
          <h3 style={s.h3}>Rotation</h3>
          <MixableSlider field="rotationX" value={(c.rotationX ?? 0) * 180 / Math.PI} isMixed={m('rotationX')}
            onChange={v => inst.updateField('rotationX', v * Math.PI / 180)} min={-180} max={180} step={1} label="X°" decimals={0} />
          <MixableSlider field="rotationY" value={(c.rotationY ?? 0) * 180 / Math.PI} isMixed={m('rotationY')}
            onChange={v => inst.updateField('rotationY', v * Math.PI / 180)} min={-180} max={180} step={1} label="Y°" decimals={0} />
          <MixableSlider field="rotationZ" value={(c.rotationZ ?? 0) * 180 / Math.PI} isMixed={m('rotationZ')}
            onChange={v => inst.updateField('rotationZ', v * Math.PI / 180)} min={-180} max={180} step={1} label="Z°" decimals={0} />
        </div>
      )}

      {/* Track To constraint */}
      <div style={s.section}>
        <h3 style={s.h3}>Track To</h3>
        {c.trackToTargetId ? (
          <>
            <div style={{ ...s.row, justifyContent: 'space-between' }}>
              <span style={{ color: '#8f8', fontSize: '11px' }}>
                ● {c.trackToTargetId}
              </span>
              <button
                style={{ ...s.btnSm, background: '#522', color: '#faa', border: '1px solid #744' }}
                onClick={() => {
                  inst.updateField('trackToTargetId', '');
                  window.dispatchEvent(new CustomEvent('overmind:track-to-clear',
                    { detail: { lightId: inst.id } }));
                }}>
                Clear
              </button>
            </div>
            <MixableCheckbox field="trackToMaintainDistance"
              checked={c.trackToMaintainDistance ?? true}
              isMixed={m('trackToMaintainDistance')}
              onChange={v => inst.updateField('trackToMaintainDistance', v)}
              label="Maintain Distance" />
            <MixableCheckbox field="trackToFollowPosition"
              checked={c.trackToFollowPosition ?? false}
              isMixed={m('trackToFollowPosition')}
              onChange={v => inst.updateField('trackToFollowPosition', v)}
              label="Follow Position" />
            {(c.lightType === 'spot' || c.lightType === 'directional') && (
              <div style={{ color: '#888', fontSize: '10px', padding: '2px 8px' }}>
                Target: X: {(c.targetX ?? 0).toFixed(1)} Y: {(c.targetY ?? 0).toFixed(1)} Z: {(c.targetZ ?? 0).toFixed(1)}
              </div>
            )}
          </>
        ) : (
          <button
            style={{ ...s.btnSm, background: '#234', color: '#8cf', border: '1px solid #456' }}
            onClick={() => window.dispatchEvent(new CustomEvent('overmind:track-to-pick-start',
              { detail: { lightId: inst.id } }))}>
            Pick Target...
          </button>
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
