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

// Mini-animations du geste de la consigne EN COURS (retour Paul : « pas une seule animation »).
const GESTURE_CSS = `
@keyframes cg-fdrag { 0%,100%{transform:translateY(-6px)} 50%{transform:translateY(6px)} }
@keyframes cg-pinchL { 0%,100%{transform:translateX(-4px)} 50%{transform:translateX(-17px)} }
@keyframes cg-pinchR { 0%,100%{transform:translateX(4px)} 50%{transform:translateX(17px)} }
@keyframes cg-click { 0%{transform:translateY(-6px) scale(1)} 40%{transform:translateY(0) scale(1)} 48%{transform:translateY(0) scale(0.8)} 62%{transform:translateY(0) scale(1)} 100%{transform:translateY(-6px) scale(1)} }
@keyframes cg-wave { 0%,42%{transform:scale(0.2);opacity:0} 50%{opacity:0.85} 100%{transform:scale(1);opacity:0} }
`;

/** Doigt (hotspot ≈ 0,0). */
function GFinger() {
  return (
    <g style={{ filter: `drop-shadow(0 0 3px ${ACCENT})` }}>
      <circle cx={0} cy={1} r={4.5} fill={ACCENT} stroke="#04141d" strokeWidth={0.8} />
      <rect x={-2} y={3} width={4} height={8} rx={2} fill={ACCENT} stroke="#04141d" strokeWidth={0.8} />
    </g>
  );
}

/** Illustration animée du geste de la consigne courante : défiler / pincer / refermer. */
function CardGesture({ stepKey }: { stepKey: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
      <svg width={104} height={46} viewBox="-52 -23 104 46" style={{ overflow: 'visible' }}>
        {stepKey === 'cardGuideScroll' && (
          <>
            <g stroke={ACCENT} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.55}>
              <path d="M -3 -15 l 3 -4 l 3 4" />
              <path d="M -3 15 l 3 4 l 3 -4" />
            </g>
            <g style={{ animation: 'cg-fdrag 1.4s ease-in-out infinite' }}><GFinger /></g>
          </>
        )}
        {stepKey === 'cardGuidePinch' && (
          <>
            <g style={{ animation: 'cg-pinchL 1.6s ease-in-out infinite' }}><GFinger /></g>
            <g style={{ animation: 'cg-pinchR 1.6s ease-in-out infinite' }}><GFinger /></g>
          </>
        )}
        {stepKey === 'cardGuideBack' && (
          <>
            <rect x={-40} y={-14} width={22} height={28} rx={3} fill="rgba(6,16,24,0.9)" stroke={ACCENT} strokeWidth={1.2} />
            <g transform="translate(14,0)">
              <circle r={11} fill="none" stroke={ACCENT} strokeWidth={1.4}
                style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'cg-wave 1.4s ease-out infinite' }} />
              <g style={{ transformBox: 'fill-box', transformOrigin: 'top left', animation: 'cg-click 1.4s ease-in-out infinite' }}><GFinger /></g>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}

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
        zIndex: 70, pointerEvents: 'none', width: 185, maxWidth: '46vw',
        background: 'rgba(8,14,22,0.92)', border: `1px solid ${ACCENT}80`, borderRadius: 10,
        padding: '13px 14px 12px', boxShadow: `0 0 18px ${ACCENT}40, inset 0 0 12px ${ACCENT}14`,
        backdropFilter: 'blur(3px)', fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
        color: '#dff6ff',
      }}
    >
      <style>{'@keyframes cg-pulse{0%,100%{opacity:1}50%{opacity:0.45}}' + GESTURE_CSS}</style>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, color: ACCENT, textShadow: `0 0 7px ${ACCENT}70`, marginBottom: 10 }}>
        {t('onboarding.b.cardGuideTitle')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {steps.map((s, i) => {
          const current = i === currentIdx;
          const col = s.done ? DONE : current ? ACCENT : '#5a7482';
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: s.done || current ? 1 : 0.6 }}>
              {/* pastille : ✓ si fait, numéro sinon */}
              <span style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                border: `1.4px solid ${col}`, color: col, fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: current ? `0 0 8px ${ACCENT}` : 'none',
                animation: current ? 'cg-pulse 1.3s ease-in-out infinite' : 'none',
              }}>
                {s.done ? '✓' : i + 1}
              </span>
              <span style={{
                fontSize: 13, lineHeight: 1.3, color: col, fontWeight: current ? 600 : 500,
                textShadow: current ? `0 0 6px ${ACCENT}55` : 'none',
              }}>
                {t(`onboarding.b.${s.key}`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Geste animé de la consigne EN COURS (défiler / pince / refermer). */}
      {!allDone && currentIdx >= 0 && <CardGesture stepKey={steps[currentIdx].key} />}

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
