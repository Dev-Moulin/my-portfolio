import { useState } from 'react';
import type { useLights } from '../../../hooks/useLights.ts';
import type { LightEntry } from '../../../machines/lightsMachine.ts';
import { powerToIntensity } from '../../../machines/lightsMachine.ts';
import { LIGHT_POSITION_PRESETS } from '../../../utils/lightPresets.ts';
import { s, presetBtnSt } from '../styles.ts';

const LIGHT_TYPE_LABELS: Record<string, string> = {
  point: 'Point', directional: 'Sun', spot: 'Spot', area: 'Area',
};

const accordionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  cursor: 'pointer', padding: '4px 0', userSelect: 'none',
};

const lightLabel: React.CSSProperties = {
  fontSize: 11, color: '#ccc', fontWeight: 600,
};

const badge: React.CSSProperties = {
  fontSize: 9, background: '#333', color: '#90A4AE', borderRadius: 3,
  padding: '1px 5px', marginLeft: 6,
};

const deleteBtn: React.CSSProperties = {
  fontSize: 10, background: '#522', color: '#f66', border: '1px solid #833',
  borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
};

function LightAccordion({ entry, lighting, isOpen, onToggle }: {
  entry: LightEntry;
  lighting: ReturnType<typeof useLights>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const intensity = powerToIntensity(entry.lightType, entry.power, entry);

  return (
    <div style={{ borderBottom: '1px solid #2a2a2a', marginBottom: 2 }}>
      <div style={accordionHeader} onClick={onToggle}>
        <span>
          <span style={lightLabel}>{isOpen ? '▾' : '▸'} {entry.id}</span>
          <span style={badge}>{LIGHT_TYPE_LABELS[entry.lightType] ?? entry.lightType}</span>
        </span>
        <button style={deleteBtn} onClick={(e) => { e.stopPropagation(); lighting.removeLight(entry.id); }}>
          Del
        </button>
      </div>

      {isOpen && (
        <div style={{ paddingLeft: 8, paddingBottom: 6 }}>
          <button
            style={{ fontSize: 10, background: '#1b3a2a', color: '#7f7', border: '1px solid #2a6', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', marginBottom: 6, width: '100%' }}
            onClick={() => window.dispatchEvent(new CustomEvent('overmind:outliner-select', { detail: { id: entry.id } }))}>
            🎯 Sélectionner (puis G pour déplacer)
          </button>
          <div style={s.row}>
            <label style={s.label}>Power (W):</label>
            <input type="number" min="0" step="1"
              value={entry.power}
              onChange={(e) => lighting.updateLight(entry.id, { power: Math.max(0, +e.target.value) })}
              style={{ width: 70, background: '#1a1a1a', color: '#ddd', border: '1px solid #3a3a3a', borderRadius: 3, padding: '2px 6px', fontSize: 11, marginLeft: 6 }} />
          </div>
          <div style={s.row}>
            <label style={s.label}>Intensity: {intensity.toFixed(2)}</label>
          </div>
          <div style={s.row}>
            <label style={s.label}>Color:</label>
            <input type="color" value={entry.color}
              onChange={(e) => lighting.updateLight(entry.id, { color: e.target.value })}
              style={{ marginLeft: 6, width: 40, height: 20, border: 'none', background: 'none', cursor: 'pointer' }} />
          </div>

          {/* Point + Spot: distance + decay */}
          {(entry.lightType === 'point' || entry.lightType === 'spot') && (<>
            <div style={s.row}>
              <label style={s.label}>Distance: {entry.distance} {entry.distance === 0 ? '(inf)' : ''}</label>
              <input style={s.range} type="range" min="0" max="100" step="1"
                value={entry.distance}
                onChange={(e) => lighting.updateLight(entry.id, { distance: +e.target.value })} />
            </div>
            <div style={s.row}>
              <label style={s.label}>Decay: {entry.decay}</label>
              <input style={s.range} type="range" min="0" max="3" step="0.5"
                value={entry.decay}
                onChange={(e) => lighting.updateLight(entry.id, { decay: +e.target.value })} />
            </div>
          </>)}

          {/* Spot: angle + penumbra */}
          {entry.lightType === 'spot' && (<>
            <div style={s.row}>
              <label style={s.label}>Angle: {((entry.angle ?? Math.PI / 6) * 180 / Math.PI).toFixed(0)} deg</label>
              <input style={s.range} type="range" min="1" max="90" step="1"
                value={(entry.angle ?? Math.PI / 6) * 180 / Math.PI}
                onChange={(e) => lighting.updateLight(entry.id, { angle: +e.target.value * Math.PI / 180 })} />
            </div>
            <div style={s.row}>
              <label style={s.label}>Penumbra: {(entry.penumbra ?? 0.3).toFixed(2)}</label>
              <input style={s.range} type="range" min="0" max="1" step="0.05"
                value={entry.penumbra ?? 0.3}
                onChange={(e) => lighting.updateLight(entry.id, { penumbra: +e.target.value })} />
            </div>
          </>)}

          {/* Area: width + height */}
          {entry.lightType === 'area' && (<>
            <div style={s.row}>
              <label style={s.label}>Width: {(entry.areaWidth ?? 2).toFixed(1)}</label>
              <input style={s.range} type="range" min="0.1" max="200" step="0.5"
                value={entry.areaWidth ?? 2}
                onChange={(e) => lighting.updateLight(entry.id, { areaWidth: +e.target.value })} />
            </div>
            <div style={s.row}>
              <label style={s.label}>Height: {(entry.areaHeight ?? 2).toFixed(1)}</label>
              <input style={s.range} type="range" min="0.1" max="200" step="0.5"
                value={entry.areaHeight ?? 2}
                onChange={(e) => lighting.updateLight(entry.id, { areaHeight: +e.target.value })} />
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

export function LightingTab({ lighting }: { lighting: ReturnType<typeof useLights> }) {
  const [openLightId, setOpenLightId] = useState<string | null>('dirLight');
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const lightsArray = Array.from(lighting.lights.values());

  const addLight = (type: 'point' | 'directional' | 'spot' | 'area') => {
    lighting.addLight({
      lightType: type,
      power: type === 'directional' ? 2 : 100,
      color: '#ffffff',
      position: { x: 0, y: 3, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      distance: 0,
      decay: 2,
    });
    setAddMenuOpen(false);
  };

  return (
    <div>
      {/* ── Environment ──────────────────────────────────────────── */}
      <div style={s.section}>
        <h3 style={s.h3}>Environment</h3>
        <div style={s.row}>
          <label style={s.label}>Ambient: {lighting.ambientIntensity.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="15" step="0.2"
            value={lighting.ambientIntensity}
            onChange={(e) => lighting.setAmbient({ intensity: +e.target.value })} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Exposure: {lighting.exposure.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.5" max="3" step="0.1"
            value={lighting.exposure}
            onChange={(e) => lighting.setExposure(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={lighting.hdrBoostEnabled} onChange={lighting.toggleHDRBoost} />
            HDR Boost
          </label>
        </div>
        {lighting.hdrBoostEnabled && (
          <div style={s.row}>
            <label style={s.label}>HDR Multiplier: {lighting.hdrBoostMultiplier.toFixed(1)}</label>
            <input style={s.range} type="range" min="1" max="5" step="0.5"
              value={lighting.hdrBoostMultiplier}
              onChange={(e) => lighting.setHDRMultiplier(+e.target.value)} />
          </div>
        )}
      </div>

      {/* ── Scene Lights ─────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={s.h3}>Scene Lights ({lightsArray.length})</h3>
          <div style={{ position: 'relative' }}>
            <button
              style={{ fontSize: 10, background: '#234', color: '#8cf', border: '1px solid #456', borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}
              onClick={() => setAddMenuOpen(!addMenuOpen)}>
              + Add
            </button>
            {addMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 20, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 4, zIndex: 10, minWidth: 100 }}>
                {(['point', 'directional', 'spot', 'area'] as const).map(t => (
                  <div key={t}
                    style={{ padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#ccc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => addLight(t)}>
                    {LIGHT_TYPE_LABELS[t]}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {lightsArray.map(entry => (
          <LightAccordion
            key={entry.id}
            entry={entry}
            lighting={lighting}
            isOpen={openLightId === entry.id}
            onToggle={() => setOpenLightId(openLightId === entry.id ? null : entry.id)}
          />
        ))}
      </div>

      {/* ── Sun Shader ──────────────────────────────────────────────── */}
      <div style={s.section}>
        <h3 style={s.h3}>Sun Shader</h3>
        <div style={s.row}>
          <label style={s.label}>Core Color:</label>
          <input type="color" value={lighting.sun.colorCore}
            onChange={(e) => lighting.updateSun({ colorCore: e.target.value })}
            style={{ marginLeft: 6, width: 40, height: 20, border: 'none', background: 'none', cursor: 'pointer' }} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Mid Color:</label>
          <input type="color" value={lighting.sun.colorMid}
            onChange={(e) => lighting.updateSun({ colorMid: e.target.value })}
            style={{ marginLeft: 6, width: 40, height: 20, border: 'none', background: 'none', cursor: 'pointer' }} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Edge Color:</label>
          <input type="color" value={lighting.sun.colorEdge}
            onChange={(e) => lighting.updateSun({ colorEdge: e.target.value })}
            style={{ marginLeft: 6, width: 40, height: 20, border: 'none', background: 'none', cursor: 'pointer' }} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Emissive: {lighting.sun.emissiveStrength.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="20" step="0.5"
            value={lighting.sun.emissiveStrength}
            onChange={(e) => lighting.updateSun({ emissiveStrength: +e.target.value })} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Displace: {lighting.sun.displaceStrength.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="1" step="0.01"
            value={lighting.sun.displaceStrength}
            onChange={(e) => lighting.updateSun({ displaceStrength: +e.target.value })} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Pulse Speed: {lighting.sun.pulseSpeed.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={lighting.sun.pulseSpeed}
            onChange={(e) => lighting.updateSun({ pulseSpeed: +e.target.value })} />
        </div>
      </div>

      {/* ── Position Presets ──────────────────────────────────────────── */}
      <div style={s.section}>
        <h3 style={s.h3}>Position Presets</h3>
        <div style={s.presetGrid}>
          {Object.entries(LIGHT_POSITION_PRESETS).map(([key, preset]) => (
            <button key={key}
              style={presetBtnSt(lighting.currentPreset === key)}
              onClick={() => lighting.applyPreset(key)}
              title={preset.description}>
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
