import type { usePBR } from '../../../hooks/usePBR.ts';
import { PBR_PRESETS } from '../../../utils/pbrPresets.ts';
import { TONE_MAPPING_OPTIONS } from '../../../utils/toneMappingMap.ts';
import { s } from '../styles.ts';

export function PBRTab({ pbr }: { pbr: ReturnType<typeof usePBR> }) {
  return (
    <div>
      <div style={s.section}>
        <h3 style={s.h3}>Tone Mapping</h3>
        <select style={s.select} value={pbr.toneMapping}
          onChange={(e) => pbr.setToneMapping(e.target.value as Parameters<typeof pbr.setToneMapping>[0])}>
          {TONE_MAPPING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {([
        { id: 'eyeRings' as const, label: 'Eye Rings' },
        { id: 'iris' as const, label: 'Iris' },
        { id: 'magicRings' as const, label: 'Magic Rings' },
        { id: 'arms' as const, label: 'Arms' },
      ]).map((group) => (
        <div key={group.id} style={s.section}>
          <h3 style={s.h3}>{group.label}</h3>
          <div style={s.row}>
            <label style={s.label}>Metalness: {pbr[group.id].metalness.toFixed(2)}</label>
            <input style={s.range} type="range" min="0" max="1" step="0.05"
              value={pbr[group.id].metalness}
              onChange={(e) => pbr.updateGroupMetalness(group.id, +e.target.value)} />
          </div>
          <div style={s.row}>
            <label style={s.label}>Roughness: {pbr[group.id].roughness.toFixed(2)}</label>
            <input style={s.range} type="range" min="0" max="1" step="0.05"
              value={pbr[group.id].roughness}
              onChange={(e) => pbr.updateGroupRoughness(group.id, +e.target.value)} />
          </div>
          <div style={s.presetGrid}>
            {Object.entries(PBR_PRESETS).map(([key, preset]) => (
              <button key={key} style={s.btnSm}
                onClick={() => pbr.applyPresetToGroup(group.id, key)}
                title={preset.description}>
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={s.section}>
        <button style={s.btnReset} onClick={pbr.restoreDefaults}>Reset All</button>
      </div>
    </div>
  );
}
