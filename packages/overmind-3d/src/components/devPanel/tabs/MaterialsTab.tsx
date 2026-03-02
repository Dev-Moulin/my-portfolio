import type { useMaterial } from '../../../hooks/useMaterial.ts';
import { s } from '../styles.ts';

export function MaterialsTab({ material }: { material: ReturnType<typeof useMaterial> }) {
  return (
    <div>
      <div style={{ ...s.section, paddingBottom: '5px' }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#444' }}>
          Couleur et intensite d'emission (glow) par groupe
        </p>
      </div>
      {([
        { name: 'iris' as const, label: 'Iris' },
        { name: 'eyeRings' as const, label: 'Eye Rings' },
        { name: 'revealRings' as const, label: 'Reveal Rings' },
      ]).map(({ name, label }) => {
        const grp = material[name];
        return (
          <div key={name} style={s.section}>
            <h3 style={s.h3}>{label}</h3>
            <div style={s.row}>
              <label style={s.label}>
                Emissive:
                <input style={s.colorInput} type="color"
                  value={grp.emissiveColor}
                  onChange={(e) => material.updateGroupEmissiveColor(name, e.target.value)} />
                <span style={{ marginLeft: '6px', color: '#444', fontSize: '10px' }}>{grp.emissiveColor}</span>
              </label>
            </div>
            <div style={s.row}>
              <label style={s.label}>Intensity: {grp.emissiveIntensity.toFixed(2)}</label>
              <input style={s.range} type="range" min="0" max="5" step="0.1"
                value={grp.emissiveIntensity}
                onChange={(e) => material.updateGroupEmissiveIntensity(name, +e.target.value)} />
            </div>
          </div>
        );
      })}
      <div style={{ ...s.section, ...s.infoBox }}>
        <strong>emissive</strong> = neon &middot; <strong>intensity</strong> = 0 eteint / 5 brillant
      </div>
    </div>
  );
}
