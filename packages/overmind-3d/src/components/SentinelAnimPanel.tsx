import { useEffect, useState } from 'react';
import { s } from './devPanel/styles.ts';

/**
 * SentinelAnimPanel — petite fenêtre FLOTTANTE (à droite de l'écran, hors du DevPanel) pour surveiller
 * et régler les transitions d'animation de la Sentinelle sans ouvrir le panneau latéral.
 *
 * Affiche le POIDS (`getEffectiveWeight`) de chaque action en temps réel + le régime courant, et
 * règle l'OVERLAP trajet AB → nage `wander_B` en FRAMES (2 axes indépendants) :
 *  - « longueur overlap » = les N dernières frames du trajet AB ;
 *  - « frames de wander consommées » = combien du DÉBUT de la nage l'overlap dépense (wander_B est
 *    scrubée sur ces frames à l'aller, puis reprend en auto). À minimiser.
 *
 * Communication (window-events) :
 *  - émission (SentinelCreatureSystem, ~20 Hz) : `overmind:sentinel-anim`
 *  - activation du flux (tant que la fenêtre est dépliée) : `overmind:sentinel-anim-debug`
 *  - réglages : `overmind:sentinel-xfade` { abFrames?, wanderFrames?, accFrames?, accDrift? }
 *    (accFrames = fondu de SORTIE accroche→nage + effets ; l'entrée est une bascule sans fondu ;
 *    accDrift = dérive « vers la carte » pendant le tuto, le long de la droite ÉCRAN)
 */

interface AnimDetail {
  regime: string;
  ab: number;
  wander: number;
  accroche: number;
  abFrame: number;
  abT: number;
  abFrames: number;
  wanderFrames: number;
}

const DEFAULT_ANIM: AnimDetail = { regime: '—', ab: 0, wander: 0, accroche: 0, abFrame: 0, abT: 0, abFrames: 60, wanderFrames: 20 };

function WeightBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: 11 }}>
        <span>{label}</span><span>{value.toFixed(2)}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color, transition: 'width 60ms linear' }} />
      </div>
    </div>
  );
}

export function SentinelAnimPanel() {
  const [open, setOpen] = useState(true);
  const [anim, setAnim] = useState<AnimDetail>(DEFAULT_ANIM);
  const [abFrames, setAbFrames] = useState(60);      // longueur overlap (frames du trajet AB)
  const [wanderFrames, setWanderFrames] = useState(20); // frames du début de wander_B consommées
  const [accFrames, setAccFrames] = useState(15);    // fondu croisé accroche ↔ nage (frames)
  const [departFrames, setDepartFrames] = useState(30); // overlap de DÉPART des trajets bakés (frames)
  const [accDrift, setAccDrift] = useState(2.4);     // dérive « vers la carte » = MAX absolu (bande 70-100 %)
  const [forcedVariant, setForcedVariant] = useState<number | null>(null); // DEV : bretelle forcée (0-based), null = auto

  // Écoute le flux + (RÉ)active l'émission. La scène 3D + la créature montent en ASYNC, APRÈS cette
  // fenêtre → un seul event d'activation partirait dans le vide (jauges figées). On RÉ-ÉMET donc
  // l'activation toutes les 500 ms jusqu'à recevoir des données, puis on arrête (couvre aussi le HMR).
  useEffect(() => {
    let gotData = false;
    const emit = () => window.dispatchEvent(new CustomEvent('overmind:sentinel-anim-debug', { detail: { enabled: open } }));
    const onAnim = (e: Event) => { gotData = true; setAnim((e as CustomEvent<AnimDetail>).detail); };
    window.addEventListener('overmind:sentinel-anim', onAnim);
    emit();
    const id = window.setInterval(() => {
      if (!open || gotData) { window.clearInterval(id); return; }
      emit();
    }, 500);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('overmind:sentinel-anim', onAnim);
      window.dispatchEvent(new CustomEvent('overmind:sentinel-anim-debug', { detail: { enabled: false } }));
    };
  }, [open]);

  const setAb = (n: number) => {
    setAbFrames(n);
    window.dispatchEvent(new CustomEvent('overmind:sentinel-xfade', { detail: { abFrames: n } }));
  };
  const setWander = (n: number) => {
    setWanderFrames(n);
    window.dispatchEvent(new CustomEvent('overmind:sentinel-xfade', { detail: { wanderFrames: n } }));
  };
  const setAcc = (n: number) => {
    setAccFrames(n);
    window.dispatchEvent(new CustomEvent('overmind:sentinel-xfade', { detail: { accFrames: n } }));
  };
  const setDrift = (n: number) => {
    setAccDrift(n);
    window.dispatchEvent(new CustomEvent('overmind:sentinel-xfade', { detail: { accDrift: n } }));
  };
  const setDepart = (n: number) => {
    setDepartFrames(n);
    window.dispatchEvent(new CustomEvent('overmind:sentinel-xfade', { detail: { departFrames: n } }));
  };
  const setVariant = (v: number | null) => {
    setForcedVariant(v);
    window.dispatchEvent(new CustomEvent('overmind:sentinel-xfade', { detail: { forcedVariant: v } }));
  };

  const overlapPct = Math.round(anim.abT * 100);

  return (
    <div
      data-ui-panel="" // exclu du drag free-look (cf. freeLookDrag.ts)
      style={{
        position: 'fixed',
        top: 64,
        right: 16,
        width: open ? 268 : 'auto',
        zIndex: 60,
        background: 'rgba(15,18,24,0.94)',
        border: '1px solid rgba(0,200,255,0.45)',
        borderRadius: 8,
        boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
        fontFamily: 'ui-monospace, monospace',
        color: '#dff6ff',
        overflow: 'hidden',
      }}
    >
      {/* Header cliquable (replier/déplier) */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', cursor: 'pointer', userSelect: 'none',
          background: 'rgba(0,200,255,0.10)', borderBottom: open ? '1px solid rgba(0,200,255,0.25)' : 'none',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#0cf' }}>Sentinelle · Transitions</span>
        <span style={{ fontSize: 11, color: '#7fd8ee' }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div style={{ padding: '8px 10px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '4px 8px', background: 'rgba(0,200,255,0.08)', borderRadius: 4 }}>
            <span style={{ color: '#0cf', fontSize: 12, fontWeight: 'bold' }}>{anim.regime}</span>
            <span style={{ color: '#888', fontSize: 11 }}>f{anim.abFrame.toFixed(0)} · {overlapPct}%</span>
          </div>
          <WeightBar label="trajet (clip actif)" value={anim.ab} color="#00bcd4" />
          <WeightBar label="nage (wander actif)" value={anim.wander} color="#4dd0e1" />
          <WeightBar label="accroche B" value={anim.accroche} color="#ffb74d" />

          <div style={{ ...s.row, marginTop: 10 }}>
            <label style={s.label}>Longueur overlap: {abFrames} f (trajet)</label>
            <input style={s.range} type="range" min="5" max="150" step="1" value={abFrames}
              onChange={(e) => setAb(+e.target.value)} />
          </div>
          <div style={s.row}>
            <label style={s.label}>Frames de wander: {wanderFrames}</label>
            <input style={s.range} type="range" min="0" max="40" step="1" value={wanderFrames}
              onChange={(e) => setWander(+e.target.value)} />
          </div>
          <div style={s.row}>
            <label style={s.label}>Overlap départ trajet: {departFrames} f</label>
            <input style={s.range} type="range" min="0" max="90" step="1" value={departFrames}
              onChange={(e) => setDepart(+e.target.value)} />
          </div>
          <div style={s.row}>
            <label style={s.label}>Fondu sortie accroche: {accFrames} f</label>
            <input style={s.range} type="range" min="1" max="60" step="1" value={accFrames}
              onChange={(e) => setAcc(+e.target.value)} />
          </div>
          <div style={s.row}>
            <label style={s.label}>Dérive carte (max): {accDrift.toFixed(2)}</label>
            <input style={s.range} type="range" min="0" max="4" step="0.05" value={accDrift}
              onChange={(e) => setDrift(+e.target.value)} />
          </div>
          <div style={{ color: '#667', fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
            Overlap = sur les N dernières frames du trajet AB, la nage monte pendant que le trajet
            descend. « Frames de wander » = combien du début de la nage on dépense (à minimiser).
            L'entrée du tuto est une bascule SANS fondu (la nage rejoint la boucle 40-55) ; le
            fondu ne règle que la sortie + le regard/dérive.
          </div>

          <div style={{ borderTop: '1px solid rgba(0,200,255,0.2)', marginTop: 8, paddingTop: 6 }}>
            {/* DEV : forcer la « bretelle » (variante de trajet) au prochain départ — pour tester
                chaque sortie à l'œil. Auto = choix par proximité de la frame 0. */}
            <div style={{ ...s.row, marginTop: 6, marginBottom: 2 }}>
              <label style={s.label}>Bretelle (variante de trajet)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([null, 0, 1, 2] as const).map((v) => (
                  <button
                    key={v === null ? 'auto' : v}
                    onClick={() => setVariant(v)}
                    style={{
                      flex: 1, padding: '4px 0', borderRadius: 3, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 11,
                      background: forcedVariant === v ? 'rgba(0,200,255,0.25)' : '#1a2027',
                      color: forcedVariant === v ? '#0cf' : '#8ab',
                      border: `1px solid ${forcedVariant === v ? '#0cf' : '#345'}`,
                    }}
                  >
                    {v === null ? 'Auto' : `${v + 1}`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ color: '#667', fontSize: 10, lineHeight: 1.4 }}>
              1 = original, 2 = _v2, 3 = _v3. Si le trajet n'a pas cette variante (BC/DB/BD : une
              seule), retour au choix auto. La variante prise s'affiche dans le régime ci-dessus
              (ex : « trajet CD_v2 (clip) ») + log console ✦ départ.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
