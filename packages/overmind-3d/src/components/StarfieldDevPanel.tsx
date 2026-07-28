import { useState } from 'react';
import type { StarDensity, StarTint } from '../scene/starfield/StarfieldSystem.ts';

/**
 * StarfieldDevPanel — panneau DEV-ONLY pour comparer les variantes de la Nuit étoilée EN DIRECT
 * (retour Paul « tester les 3 »). Émet `overmind:starfield-config` { density, tint } → le
 * StarfieldSystem régénère la voûte. À monter derrière `import.meta.env.DEV` uniquement.
 */

const DENSITIES: { key: StarDensity; label: string }[] = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'discret', label: 'Discret' },
  { key: 'medium', label: 'Moyen' },
  { key: 'dense', label: 'Dense' },
];
const TINTS: { key: StarTint; label: string }[] = [
  { key: 'white', label: 'Blanc' },
  { key: 'cyan', label: 'Blanc+Cyan' },
  { key: 'varied', label: 'Varié' },
];

const wrap: React.CSSProperties = {
  position: 'fixed', left: 12, bottom: 12, zIndex: 10000,
  background: 'rgba(6,14,22,0.82)', border: '1px solid rgba(0,229,255,0.35)', borderRadius: 8,
  padding: '8px 10px', font: '600 11px/1.4 monospace', color: '#cfeaff',
  boxShadow: '0 0 14px rgba(0,229,255,0.25)', backdropFilter: 'blur(4px)', userSelect: 'none',
};
const row: React.CSSProperties = { display: 'flex', gap: 4, marginTop: 4 };
const title: React.CSSProperties = { color: 'rgba(0,229,255,0.9)', letterSpacing: 1, fontSize: 10 };

function btn(active: boolean): React.CSSProperties {
  return {
    cursor: 'pointer', padding: '3px 7px', borderRadius: 5, fontSize: 11, fontFamily: 'monospace',
    border: active ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.18)',
    background: active ? 'rgba(0,229,255,0.25)' : 'rgba(255,255,255,0.05)',
    color: active ? '#eaffff' : '#9fbccc',
  };
}

export function StarfieldDevPanel() {
  const [density, setDensity] = useState<StarDensity>('dense');
  const [tint, setTint] = useState<StarTint>('varied');

  const apply = (d: StarDensity, t: StarTint) => {
    setDensity(d); setTint(t);
    window.dispatchEvent(new CustomEvent('overmind:starfield-config', { detail: { density: d, tint: t } }));
  };

  return (
    <div style={wrap}>
      <div style={title}>✦ NUIT ÉTOILÉE (dev)</div>
      <div style={row}>
        {DENSITIES.map((d) => (
          <button key={d.key} style={btn(density === d.key)} onClick={() => apply(d.key, tint)}>{d.label}</button>
        ))}
      </div>
      <div style={row}>
        {TINTS.map((t) => (
          <button key={t.key} style={btn(tint === t.key)} onClick={() => apply(density, t.key)}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}
