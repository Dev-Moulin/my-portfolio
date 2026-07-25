import { useEffect, useState } from 'react';

interface GaugeUpdateDetail {
  value: number;       // -1..+1
  state: 'dwell' | 'playing' | 'free';
  currentPoint: 'A' | 'B' | 'C' | 'D';
  canGoForward: boolean;
  canGoBackward: boolean;
}

const DEFAULT_DETAIL: GaugeUpdateDetail = {
  value: 0,
  state: 'dwell',
  currentPoint: 'A',
  canGoForward: true,
  canGoBackward: false,
};

const HEIGHT = 240;
const HALF = HEIGHT / 2;

// Animations d'onboarding (glow pulsé sur la barre + gros "SCROLL" central qui pulse/glitch +
// 2 chevrons qui bobent). Injectées une fois ; ne tournent que tant que l'utilisateur n'a pas scrollé.
const ONBOARDING_CSS = `
@keyframes sg-glow-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(0,188,212,0.45), 0 0 22px rgba(0,188,212,0.22); }
  50%      { box-shadow: 0 0 16px rgba(0,188,212,0.85), 0 0 34px rgba(0,188,212,0.45); }
}
@keyframes sg-hint-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
@keyframes sg-hint-glitch {
  0%, 78%, 100% { transform: translate(0,0); text-shadow: 0 0 12px rgba(0,188,212,0.9); }
  80% { transform: translate(-4px, 2px);  text-shadow: -5px 0 #ff00c1, 5px 0 #00fff9, 0 0 12px rgba(0,188,212,0.9); }
  83% { transform: translate(4px, -2px);  text-shadow:  5px 0 #ff00c1, -5px 0 #00fff9, 0 0 12px rgba(0,188,212,0.9); }
  86% { transform: translate(-3px, 0);    text-shadow: -3px 0 #ff00c1, 3px 0 #00fff9, 0 0 12px rgba(0,188,212,0.9); }
  89% { transform: translate(0,0);        text-shadow: 0 0 12px rgba(0,188,212,0.9); }
}
@keyframes sg-arrow-bob {
  0%, 100% { transform: translateY(0);   opacity: 0.55; }
  50%      { transform: translateY(10px); opacity: 1; }
}
`;

interface TeachState { active: boolean; upDone: boolean; downDone: boolean }
const NO_TEACH: TeachState = { active: false, upDone: false, downDone: false };

// Mot d'onboarding adapté à l'appareil (retour Paul) : molette au doigt → « swipe », sinon « scroll ».
// Mots universels (compris FR/EN) → pas besoin d'i18n dans ce composant de package.
const IS_COARSE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
const HINT_WORD = IS_COARSE ? 'swipe' : 'scroll';

export function ScrollGaugeOverlay() {
  const [detail, setDetail] = useState<GaugeUpdateDetail>(DEFAULT_DETAIL);
  const [hasScrolled, setHasScrolled] = useState(false);
  // Étape 1 du tuto (apprentissage du scroll) : met la barre en valeur + allume la zone testée.
  const [teach, setTeach] = useState<TeachState>(NO_TEACH);
  const [chargeValue, setChargeValue] = useState(0); // charge de la jauge pendant l'apprentissage (-1..+1)

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<GaugeUpdateDetail>).detail;
      setDetail(d);
      // On n'éteint l'indice QUE si un trajet a réellement DÉMARRÉ (state 'playing'). Un swipe/scroll
      // trop faible bouge la jauge (value≠0) sans lancer le trajet → l'indice doit RESTER, sinon
      // l'utilisateur attend bêtement devant un écran muet (retour Paul, desktop ET mobile).
      if (d.state === 'playing') setHasScrolled(true);
    };
    // Naviguer via la NavArc (saut de point) sans scroller compte AUSSI comme onboarding terminé,
    // sinon l'indice réapparaît au point d'arrivée (l'utilisateur a déjà « compris »).
    const onNavTransition = () => setHasScrolled(true);
    const onOnboarding = (e: Event) => {
      const t = (e as CustomEvent<{ teach?: TeachState }>).detail?.teach;
      const active = !!t?.active;
      setTeach(active ? t : NO_TEACH);
      if (!active) setChargeValue(0); // fin d'apprentissage → vide la charge
    };
    const onCharge = (e: Event) => {
      setChargeValue((e as CustomEvent<{ value: number }>).detail?.value ?? 0);
    };
    window.addEventListener('overmind:scroll-gauge-update', handler);
    window.addEventListener('overmind:nav-transition', onNavTransition);
    window.addEventListener('overmind:onboarding', onOnboarding);
    window.addEventListener('overmind:onboarding-charge', onCharge);
    return () => {
      window.removeEventListener('overmind:scroll-gauge-update', handler);
      window.removeEventListener('overmind:nav-transition', onNavTransition);
      window.removeEventListener('overmind:onboarding', onOnboarding);
      window.removeEventListener('overmind:onboarding-charge', onCharge);
    };
  }, []);

  const teaching = teach.active;
  const visible = detail.state === 'dwell' || teaching;
  // Le remplissage SUIT LE GESTE (affordance scrollbar) : molette vers le haut → remplit EN HAUT,
  // molette vers le bas → remplit EN BAS. D'où l'inversion du signe (accumulateur bas = value+).
  const value = -Math.max(-1, Math.min(1, teaching ? chargeValue : detail.value));
  const fillHeight = Math.abs(value) * HALF;
  // Emphase d'onboarding : seulement au tout début (avant le 1er scroll) et quand la barre est visible.
  const attract = !hasScrolled && visible;
  // Le glow de la barre reste tant qu'elle est visible (au repos), pas seulement avant le 1er scroll.
  const barGlow = visible;

  return (
    <>
      <style>{ONBOARDING_CSS}</style>

      {/* Indice d'onboarding PLEIN ÉCRAN : gros "SCROLL" pulsant + glitch + 2 chevrons animés. */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        zIndex: 101,
        pointerEvents: 'none',
        opacity: attract ? 1 : 0,
        transition: 'opacity 500ms ease',
        animation: attract ? 'sg-hint-pulse 1.6s ease-in-out infinite' : 'none',
      }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: 10,
          textTransform: 'uppercase',
          color: '#e0fbff',
          animation: attract ? 'sg-hint-glitch 2.4s ease-in-out infinite' : 'none',
        }}>{HINT_WORD}</span>
        {/* 2 chevrons en grande taille, bob décalé → écoulement vers le bas */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0.55 }}>
          <span style={{
            fontSize: 64,
            color: '#4dd0e1',
            textShadow: '0 0 14px rgba(0,188,212,0.7)',
            animation: attract ? 'sg-arrow-bob 1.2s ease-in-out infinite' : 'none',
          }}>⌄</span>
          <span style={{
            fontSize: 64,
            color: '#4dd0e1',
            textShadow: '0 0 14px rgba(0,188,212,0.7)',
            animation: attract ? 'sg-arrow-bob 1.2s ease-in-out 0.18s infinite' : 'none',
          }}>⌄</span>
        </div>
      </div>

      {/* Barre latérale d'état du scroll (ÉLARGIE + pulse renforcé pendant l'apprentissage) */}
      <div
        style={{
          position: 'fixed',
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          width: teaching ? 22 : 14,
          height: HEIGHT,
          background: barGlow ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
          borderRadius: 7,
          border: barGlow ? '1px solid rgba(0,188,212,0.7)' : '1px solid rgba(255,255,255,0.15)',
          boxShadow: teaching ? '0 0 26px rgba(0,188,212,0.85)' : barGlow ? '0 0 14px rgba(0,188,212,0.6)' : 'none',
          animation: (barGlow || teaching) ? 'sg-glow-pulse 1.6s ease-in-out infinite' : 'none',
          pointerEvents: 'none',
          zIndex: 100,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease, width 300ms ease, background 400ms ease, border-color 400ms ease, box-shadow 400ms ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Zone HAUTE (scroll vers le HAUT) — CYAN, s'allume quand ce sens est testé */}
        <div style={{
          position: 'absolute',
          top: 4,
          bottom: HALF + 1,
          left: 4,
          right: 4,
          background: teaching
            ? (teach.upDone ? 'rgba(0,188,212,0.6)' : 'rgba(0,188,212,0.14)')
            : (detail.canGoBackward ? 'rgba(255,255,255,0.04)' : 'rgba(80,80,80,0.15)'),
          boxShadow: teaching && teach.upDone ? '0 0 12px rgba(0,188,212,0.8)' : 'none',
          borderRadius: 4,
          transition: 'background 250ms ease, box-shadow 250ms ease',
        }} />
        {/* Zone BASSE (scroll vers le BAS) — ORANGE, s'allume quand ce sens est testé */}
        <div style={{
          position: 'absolute',
          top: HALF + 1,
          bottom: 4,
          left: 4,
          right: 4,
          background: teaching
            ? (teach.downDone ? 'rgba(77,255,102,0.55)' : 'rgba(77,255,102,0.13)')
            : (detail.canGoForward ? 'rgba(255,255,255,0.04)' : 'rgba(80,80,80,0.15)'),
          boxShadow: teaching && teach.downDone ? '0 0 12px rgba(77,255,102,0.8)' : 'none',
          borderRadius: 4,
          transition: 'background 250ms ease, box-shadow 250ms ease',
        }} />
        {/* Center neutral line */}
        <div style={{
          position: 'absolute',
          top: HALF - 0.5,
          left: 2,
          right: 2,
          height: 1,
          background: 'rgba(255,255,255,0.4)',
        }} />
        {/* Forward fill (value > 0) */}
        {value > 0 && (
          <div style={{
            position: 'absolute',
            left: 4,
            right: 4,
            bottom: HALF,
            height: fillHeight,
            background: 'linear-gradient(to top, #4dd0e1, #00bcd4)',
            borderRadius: 4,
            transition: 'height 80ms linear',
            boxShadow: '0 0 8px rgba(0,188,212,0.6)',
          }} />
        )}
        {/* Backward fill (value < 0) */}
        {value < 0 && (
          <div style={{
            position: 'absolute',
            left: 4,
            right: 4,
            top: HALF,
            height: fillHeight,
            background: 'linear-gradient(to bottom, #a5ffb5, #1fe84a)',
            borderRadius: 4,
            transition: 'height 80ms linear',
            boxShadow: '0 0 8px rgba(77,255,102,0.6)',
          }} />
        )}
      </div>
    </>
  );
}
