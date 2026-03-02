import type { useNeonBands } from '../../../hooks/useNeonBands.ts';
import { NEON_PRESET_NAMES } from '../../../machines/neonBandsMachine.ts';
import { s } from '../styles.ts';

export function NeonTab({ neon }: { neon: ReturnType<typeof useNeonBands> }) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Presets</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {NEON_PRESET_NAMES.map((name) => (
            <button key={name}
              style={{ ...s.btnReset, fontSize: '10px', padding: '3px 8px' }}
              onClick={() => neon.applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Global Width</h3>
        <div style={s.row}>
          <label style={s.label}>All Bands: {neon.bands[0]?.width.toFixed(2) ?? '0.60'}</label>
          <input style={s.range} type="range" min="0.1" max="3" step="0.05"
            value={neon.bands[0]?.width ?? 0.6}
            onChange={(e) => neon.setAllWidths(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Cascade Flow</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={neon.flowEnabled} onChange={neon.toggleFlow} />
            Enable Flow Animation
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>Flow Speed: {neon.flowSpeed.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="5" step="0.1"
            value={neon.flowSpeed}
            onChange={(e) => neon.updateFlowSpeed(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Global Intensity: {neon.globalIntensity.toFixed(1)}</label>
          <input style={s.range} type="range" min="0" max="3" step="0.1"
            value={neon.globalIntensity}
            onChange={(e) => neon.updateGlobalIntensity(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Position & Scale</h3>
        <div style={s.row}>
          <label style={s.label}>X: {neon.positionX.toFixed(1)}</label>
          <input style={s.range} type="range" min="-15" max="15" step="0.5"
            value={neon.positionX}
            onChange={(e) => neon.updatePositionX(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Y: {neon.positionY.toFixed(1)}</label>
          <input style={s.range} type="range" min="-10" max="10" step="0.5"
            value={neon.positionY}
            onChange={(e) => neon.updatePositionY(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Z (profondeur): {neon.positionZ.toFixed(1)}</label>
          <input style={s.range} type="range" min="-20" max="0" step="0.5"
            value={neon.positionZ}
            onChange={(e) => neon.updatePositionZ(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Scale: {neon.scale.toFixed(2)}</label>
          <input style={s.range} type="range" min="0.1" max="3" step="0.05"
            value={neon.scale}
            onChange={(e) => neon.updateScale(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Layout</h3>
        <div style={s.row}>
          <label style={s.label}>Band Spacing: {neon.bandSpacing.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="1" step="0.05"
            value={neon.bandSpacing}
            onChange={(e) => neon.updateBandSpacing(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Arc Radius: {neon.arcRadius.toFixed(1)}</label>
          <input style={s.range} type="range" min="2" max="10" step="0.5"
            value={neon.arcRadius}
            onChange={(e) => neon.updateArcRadius(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Depth Spread: {neon.depthSpread.toFixed(1)}x</label>
          <input style={s.range} type="range" min="1" max="8" step="0.1"
            value={neon.depthSpread}
            onChange={(e) => neon.updateDepthSpread(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Line Length: {neon.lineLength.toFixed(0)}</label>
          <input style={s.range} type="range" min="5" max="30" step="1"
            value={neon.lineLength}
            onChange={(e) => neon.updateLineLength(+e.target.value)} />
        </div>
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Cylinder Array</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={neon.cylinderMode}
              onChange={neon.toggleCylinderMode} />
            Enable Cylinder Mode
          </label>
        </div>
        {neon.cylinderMode && (
          <>
            <div style={s.row}>
              <label style={s.label}>Radius: {neon.cylinderRadius.toFixed(1)}</label>
              <input style={s.range} type="range" min="1" max="20" step="0.5"
                value={neon.cylinderRadius}
                onChange={(e) => neon.updateCylinderRadius(+e.target.value)} />
            </div>
            <div style={s.row}>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={neon.cylinderAutoFill}
                  onChange={neon.toggleCylinderAutoFill} />
                Auto-fill
              </label>
            </div>
            {!neon.cylinderAutoFill && (
              <div style={s.row}>
                <label style={s.label}>Copies: {neon.cylinderCopies}</label>
                <input style={s.range} type="range" min="1" max="36" step="1"
                  value={neon.cylinderCopies}
                  onChange={(e) => neon.updateCylinderCopies(+e.target.value)} />
              </div>
            )}
            <div style={s.row}>
              <label style={s.label}>Direction:</label>
              <select value={neon.cylinderDirection}
                onChange={(e) => neon.updateCylinderDirection(e.target.value as 'outward' | 'inward')}
                style={{ background: '#222', color: '#ddd', border: '1px solid #3a3a3a', padding: '2px 6px', fontSize: '11px' }}>
                <option value="outward">Outward</option>
                <option value="inward">Inward</option>
              </select>
            </div>
          </>
        )}
      </div>
      <div style={s.section}>
        <h3 style={s.h3}>Bands ({neon.bands.length})</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {neon.bands.map((band, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 0', borderBottom: '1px solid #1a1a1a',
            }}>
              <input type="checkbox" checked={band.visible}
                onChange={() => neon.toggleBandVisible(i)} />
              <input style={s.colorInput} type="color" value={band.color}
                onChange={(e) => neon.updateBandColor(i, e.target.value)} />
              <span style={{ color: '#888', fontSize: '10px', minWidth: '18px' }}>{i}</span>
              <input style={{ ...s.range, flex: 1 }} type="range" min="0.1" max="3" step="0.05"
                value={band.width} title="Width"
                onChange={(e) => neon.updateBandWidth(i, +e.target.value)} />
              <span style={{ color: '#555', fontSize: '9px', width: '20px' }}>{band.width.toFixed(1)}</span>
              <input style={{ ...s.range, flex: 1 }} type="range" min="0" max="5" step="0.1"
                value={band.intensity} title="Intensity"
                onChange={(e) => neon.updateBandIntensity(i, +e.target.value)} />
              <span style={{ color: '#555', fontSize: '9px', width: '20px' }}>{band.intensity.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={s.section}>
        <button style={s.btnReset} onClick={neon.restoreDefaults}>Reset All</button>
      </div>
    </div>
  );
}
