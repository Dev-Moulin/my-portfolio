import type { useBloom } from '../../../hooks/useBloom.ts';
import { s } from '../styles.ts';

export function BloomTab({ bloom }: { bloom: ReturnType<typeof useBloom> }) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Global Bloom</h3>
        <div style={s.row}>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={bloom.enabled} onChange={bloom.toggleBloom} />
            Enable Bloom
          </label>
        </div>
        <div style={s.row}>
          <label style={s.label}>Threshold: {bloom.threshold.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="1" step="0.01"
            value={bloom.threshold} disabled={!bloom.enabled}
            onChange={(e) => bloom.updateThreshold(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Strength: {bloom.strength.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="3" step="0.1"
            value={bloom.strength} disabled={!bloom.enabled}
            onChange={(e) => bloom.updateStrength(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>Radius: {bloom.radius.toFixed(2)}</label>
          <input style={s.range} type="range" min="0" max="1" step="0.01"
            value={bloom.radius} disabled={!bloom.enabled}
            onChange={(e) => bloom.updateRadius(+e.target.value)} />
        </div>
        <div style={s.row}>
          <label style={s.label}>
            Color:
            <input style={s.colorInput} type="color"
              value={bloom.bloomColor} disabled={!bloom.enabled}
              onChange={(e) => bloom.setBloomColor(e.target.value)} />
            <span style={{ marginLeft: '6px', color: '#555', fontSize: '10px' }}>{bloom.bloomColor}</span>
          </label>
        </div>
        <button style={s.btnReset} onClick={bloom.restoreDefaults}>Reset</button>
      </div>
    </div>
  );
}
