import { useState } from 'react';
import type { StarDensity, StarTint } from '../../../scene/starfield/StarfieldSystem.ts';
import { s, presetBtnSt } from '../styles.ts';

/**
 * StarfieldTab — réglages « Nuit étoilée » (densité × teinte) EN DIRECT, dans le DevControlPanel.
 * Émet `overmind:starfield-config` { density, tint } → le StarfieldSystem régénère la voûte.
 * (Remplace l'ancien petit panneau autonome StarfieldDevPanel, qui gênait le bouton son en bas-gauche.)
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

export function StarfieldTab() {
  const [density, setDensity] = useState<StarDensity>('dense');
  const [tint, setTint] = useState<StarTint>('varied');

  const apply = (d: StarDensity, t: StarTint) => {
    setDensity(d);
    setTint(t);
    window.dispatchEvent(new CustomEvent('overmind:starfield-config', { detail: { density: d, tint: t } }));
  };

  return (
    <div style={s.section}>
      <h3 style={s.h3}>Nuit étoilée</h3>

      <div style={s.row}>
        <label style={s.label}>Densité</label>
        <div style={s.flexRow}>
          {DENSITIES.map((d) => (
            <button key={d.key} style={presetBtnSt(density === d.key)} onClick={() => apply(d.key, tint)}>{d.label}</button>
          ))}
        </div>
      </div>

      <div style={s.row}>
        <label style={s.label}>Teinte</label>
        <div style={s.flexRow}>
          {TINTS.map((t) => (
            <button key={t.key} style={presetBtnSt(tint === t.key)} onClick={() => apply(density, t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={s.infoBox}>Réglage en direct (dev). Défauts prod : Varié + densité adaptée à l'appareil.</div>
    </div>
  );
}
