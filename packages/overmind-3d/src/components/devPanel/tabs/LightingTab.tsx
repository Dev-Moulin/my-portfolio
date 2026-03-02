import type { useLighting } from '../../../hooks/useLighting.ts';
import { LIGHT_POSITION_PRESETS } from '../../../utils/lightPresets.ts';
import { s, presetBtnSt } from '../styles.ts';

export function LightingTab({ lighting }: { lighting: ReturnType<typeof useLighting> }) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Intensities</h3>
        <div style={s.row}>
          <label style={s.label}>Ambient: {lighting.ambientIntensity.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="2" step="0.1"
            value={lighting.ambientIntensity}
            onChange={(e) => lighting.updateAmbientIntensity(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Directional: {lighting.directionalIntensity.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={lighting.directionalIntensity}
            onChange={(e) => lighting.updateDirectionalIntensity(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Point: {lighting.pointIntensity.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={lighting.pointIntensity}
            onChange={(e) => lighting.updatePointIntensity(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Exposure & HDR</h3>
        <div style={s.row}>
          <label style={s.label}>Exposure: {lighting.exposure.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.5" max="3" step="0.1"
            value={lighting.exposure}
            onChange={(e) => lighting.updateExposure(+e.target.value)} />
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
              onChange={(e) => lighting.updateHDRMultiplier(+e.target.value)} />
          </div>
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Position Presets</h3>
        <div style={s.presetGrid}>
          {Object.entries(LIGHT_POSITION_PRESETS).map(([key, preset]) => (
            <button key={key}
              style={presetBtnSt(lighting.currentPreset === key)}
              onClick={() => lighting.applyLightPreset(key)}
              title={preset.description}>
              {preset.name}
            </button>
          ))}
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Directional Position</h3>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <div key={axis} style={s.row}>
            <label style={s.label}>
              {axis.toUpperCase()}: {lighting.directionalPosition[axis].toFixed(1)}
            </label>
            <input style={s.range} type="range" min="-10" max="10" step="0.5"
              value={lighting.directionalPosition[axis]}
              onChange={(e) => lighting.updateDirectionalPosition({
                ...lighting.directionalPosition, [axis]: +e.target.value
              })} />
          </div>
        ))}
      </div>
    </div>
  );
}
