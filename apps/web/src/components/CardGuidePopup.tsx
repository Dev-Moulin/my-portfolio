import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * CardGuidePopup — pop-up de consignes FIXE À DROITE, guidage de l'étape « écran holo » sur MOBILE (F2).
 *
 * Remplace la bulle-sur-l'œil pendant toute l'étape carte (masquée par le bridge sur mobile). Coche la
 * progression SÉQUENTIELLE : Tap → Défiler → Pince → Retour. Chaque geste débloque le suivant ; l'étape
 * courante = la 1re consigne non faite. Purement indicatif (pointer-events:none) — les gestes se font sur
 * la carte / la scène. Ne se rend QUE sur pointeur grossier (mobile) et à l'étape 'screen'.
 *
 * Piloté par l'event `overmind:onboarding` (detail.screen = { active, opened, scrolled, pinched, closed }).
 */

const ACCENT = '#00d0fa';
const DONE = '#4dff7a';

interface ScreenState { active: boolean; opened: boolean; scrolled: boolean; pinched: boolean; closed: boolean }

export default function CardGuidePopup() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<ScreenState | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ screen?: ScreenState }>).detail;
      setScreen(d?.screen ?? null);
    };
    window.addEventListener('overmind:onboarding', handler);
    return () => window.removeEventListener('overmind:onboarding', handler);
  }, []);

  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  // La pop-up n'apparaît QU'APRÈS le 1er tap (carte ouverte) : avant, la bulle-sur-l'œil garde « Tapez la
  // carte » + son schéma animé. Elle reste ensuite jusqu'à la fin de l'étape (porte le « Balayez… »).
  if (!coarse || !screen?.active || !screen.opened) return null;

  // Consignes ordonnées : chacune « faite » selon son drapeau ; l'étape EN COURS = la 1re non faite.
  const steps = [
    { key: 'cardGuideTap', done: screen.opened },
    { key: 'cardGuideScroll', done: screen.scrolled },
    { key: 'cardGuidePinch', done: screen.pinched },
    { key: 'cardGuideBack', done: screen.closed },
  ];
  const currentIdx = steps.findIndex(s => !s.done); // -1 = tout fait
  const allDone = currentIdx === -1;

  return (
    <div
      style={{
        position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)',
        zIndex: 70, pointerEvents: 'none', width: 168, maxWidth: '42vw',
        background: 'rgba(8,14,22,0.92)', border: `1px solid ${ACCENT}80`, borderRadius: 10,
        padding: '12px 12px 11px', boxShadow: `0 0 18px ${ACCENT}40, inset 0 0 12px ${ACCENT}14`,
        backdropFilter: 'blur(3px)', fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
        color: '#dff6ff',
      }}
    >
      <style>{'@keyframes cg-pulse{0%,100%{opacity:1}50%{opacity:0.45}}'}</style>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: ACCENT, textShadow: `0 0 7px ${ACCENT}70`, marginBottom: 9 }}>
        {t('onboarding.b.cardGuideTitle')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s, i) => {
          const current = i === currentIdx;
          const col = s.done ? DONE : current ? ACCENT : '#5a7482';
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: s.done || current ? 1 : 0.6 }}>
              {/* pastille : ✓ si fait, numéro sinon */}
              <span style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                border: `1.4px solid ${col}`, color: col, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: current ? `0 0 8px ${ACCENT}` : 'none',
                animation: current ? 'cg-pulse 1.3s ease-in-out infinite' : 'none',
              }}>
                {s.done ? '✓' : i + 1}
              </span>
              <span style={{
                fontSize: 12, lineHeight: 1.3, color: col, fontWeight: current ? 600 : 500,
                textShadow: current ? `0 0 6px ${ACCENT}55` : 'none',
              }}>
                {t(`onboarding.b.${s.key}`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Séquence terminée : la bulle-œil étant masquée, la pop-up porte l'indication pour avancer. */}
      {allDone && (
        <div style={{
          marginTop: 11, textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
          color: ACCENT, textShadow: `0 0 7px ${ACCENT}70`, animation: 'cg-pulse 1.3s ease-in-out infinite',
        }}>
          {t('onboarding.b.hintTouch')}
        </div>
      )}
    </div>
  );
}
