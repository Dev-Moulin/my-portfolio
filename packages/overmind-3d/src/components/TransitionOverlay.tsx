import { useEffect, useRef, useState } from 'react';

type RestPoint = 'A' | 'B' | 'C' | 'D';
type Phase = 'idle' | 'in' | 'out';

// Durées (ms). IN = EXTINCTION CRT (l'image s'écrase en ligne → point → noir) ; au pic (noir) on
// déclenche le snap caméra caché. OUT = ALLUMAGE CRT (point → ligne → déploiement) révélant le
// nouveau lieu. Un poil plus longues que l'ancien glitch pour que le « geste » se lise.
const IN_MS = 320;
const OUT_MS = 360;

// Couleur du flash CRT (accord Paul 2026-07-08) : blanc à cœur + halo cyan (raccord univers holo).
const CORE = '#ffffff';
const HALO = '#00e5ff';

// Neige TV (bruit) plein écran — SVG feTurbulence en data-URI, tuilé + scintillé.
const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const TRANSITION_CSS = `
@keyframes crt-shake {
  0%   { transform: translate(0,0); }
  25%  { transform: translate(-2px, 1px); }
  50%  { transform: translate(2px, -2px); }
  75%  { transform: translate(-1px, 2px); }
  100% { transform: translate(0,0); }
}
/* Voile : deux barres noires qui CONVERGENT vers le centre (l'image s'aspire vers la ligne). */
@keyframes crt-bars-in {
  0%   { transform: scaleY(0); }
  52%  { transform: scaleY(0.9); }
  74%  { transform: scaleY(1); }
  100% { transform: scaleY(1); }
}
@keyframes crt-bars-out {
  0%   { transform: scaleY(1); }
  26%  { transform: scaleY(1); }
  52%  { transform: scaleY(0.9); }
  100% { transform: scaleY(0); }
}
/* Ligne de phosphore : pleine largeur quand les barres se rejoignent, puis contraction en point. */
@keyframes crt-line-in {
  0%   { opacity: 0; transform: translateY(-50%) scaleX(1); }
  38%  { opacity: 1; transform: translateY(-50%) scaleX(1); }
  74%  { opacity: 1; transform: translateY(-50%) scaleX(1); }
  88%  { opacity: 1; transform: translateY(-50%) scaleX(0.015); }
  95%  { opacity: 1; transform: translateY(-50%) scaleX(0.02); }
  100% { opacity: 0; transform: translateY(-50%) scaleX(0); }
}
@keyframes crt-line-out {
  0%   { opacity: 0; transform: translateY(-50%) scaleX(0); }
  14%  { opacity: 1; transform: translateY(-50%) scaleX(0.02); }
  36%  { opacity: 1; transform: translateY(-50%) scaleX(1); }
  72%  { opacity: 0.8; transform: translateY(-50%) scaleX(1); }
  100% { opacity: 0; transform: translateY(-50%) scaleX(1); }
}
/* Arrachage chromatique PLEIN ÉCRAN — les bandes se décalent horizontalement par saccades. */
@keyframes crt-tear-a {
  0%,100% { transform: translateX(0); }
  20% { transform: translateX(-14px); }
  40% { transform: translateX(9px); }
  60% { transform: translateX(-7px); }
  80% { transform: translateX(12px); }
}
@keyframes crt-tear-b {
  0%,100% { transform: translateX(0); }
  25% { transform: translateX(13px); }
  50% { transform: translateX(-10px); }
  70% { transform: translateX(6px); }
  90% { transform: translateX(-12px); }
}
/* Neige TV : scintille + défile (positions tuilées qui sautent). */
@keyframes crt-noise {
  0%   { opacity: 0.38; background-position: 0 0; }
  25%  { opacity: 0.55; background-position: -60px 45px; }
  50%  { opacity: 0.30; background-position: 45px -65px; }
  75%  { opacity: 0.58; background-position: -35px 25px; }
  100% { opacity: 0.42; background-position: 65px 55px; }
}
@keyframes crt-scan {
  0%   { background-position-y: 0; }
  100% { background-position-y: 140px; }
}
`;

/**
 * TransitionOverlay — masque le saut de caméra de la NavArc par une transition « TV cathodique »
 * (CRT on/off + glitch couleurs PLEIN ÉCRAN). Écoute `overmind:nav-transition` {point} :
 *   1. EXTINCTION (IN_MS) : glitch plein écran, l'image s'écrase en ligne → point → noir ;
 *   2. au pic (noir) : dispatch `overmind:camera-jump` {point} → le snap se fait CACHÉ ;
 *   3. ALLUMAGE (OUT_MS) : point → ligne → déploiement, révèle le nouveau lieu.
 * Les trajets molette normaux (animations caméra fluides) ne passent PAS par ici.
 */
export function TransitionOverlay() {
  const [phase, setPhase] = useState<Phase>('idle');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
    };

    const handler = (e: Event) => {
      const point = (e as CustomEvent<RestPoint>).detail;
      clearTimers();
      setPhase('in');
      // Au pic (écran noir) : snap caméra caché, puis on enchaîne l'allumage.
      timers.current.push(
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('overmind:camera-jump', { detail: point }));
          setPhase('out');
        }, IN_MS),
      );
      timers.current.push(
        window.setTimeout(() => setPhase('idle'), IN_MS + OUT_MS),
      );
    };

    window.addEventListener('overmind:nav-transition', handler);
    return () => {
      window.removeEventListener('overmind:nav-transition', handler);
      clearTimers();
    };
  }, []);

  const active = phase !== 'idle';
  const dur = phase === 'in' ? IN_MS : OUT_MS;

  // Animations dépendantes de la phase (les keyframes IN/OUT diffèrent → geste symétrique inversé).
  const barAnim = phase === 'in' ? `crt-bars-in ${IN_MS}ms ease-in forwards`
    : phase === 'out' ? `crt-bars-out ${OUT_MS}ms ease-out forwards` : 'none';
  const lineAnim = phase === 'in' ? `crt-line-in ${IN_MS}ms ease-in forwards`
    : phase === 'out' ? `crt-line-out ${OUT_MS}ms ease-out forwards` : 'none';

  // Barre noire (haut ou bas) qui converge vers le centre.
  const bar = (edge: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    right: 0,
    [edge]: 0,
    height: '50.5%', // léger recouvrement au centre pour ne pas laisser de filet
    background: '#04060a',
    transformOrigin: edge,
    transform: 'scaleY(0)',
    animation: barAnim,
  });

  // Couche d'arrachage chromatique plein écran (bandes horizontales fines qui se décalent).
  const tear = (color: string, anim: string): React.CSSProperties => ({
    position: 'absolute',
    inset: '-2% 0',
    background: `repeating-linear-gradient(0deg, transparent 0 2px, ${color} 2px 3px, transparent 3px 7px)`,
    mixBlendMode: 'screen',
    animation: active ? `${anim} ${dur}ms steps(8, end) infinite` : 'none',
    opacity: active ? 0.5 : 0,
  });

  return (
    <>
      <style>{TRANSITION_CSS}</style>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          pointerEvents: 'none',
          opacity: active ? 1 : 0,
          animation: active ? `crt-shake 200ms ease-in-out infinite` : 'none',
        }}
      >
        {/* 1. Barres noires convergentes = collapse vertical (l'image s'aspire vers la ligne) */}
        <div style={bar('top')} />
        <div style={bar('bottom')} />

        {/* 2. Glitch PLEIN ÉCRAN (au-dessus du noir → couvre toute la surface, façon TV cassée) */}
        {/* Neige TV */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: NOISE_URL,
            backgroundSize: '140px 140px',
            mixBlendMode: 'screen',
            animation: active ? `crt-noise ${Math.round(dur / 3)}ms steps(3, end) infinite` : 'none',
            opacity: active ? 1 : 0,
          }}
        />
        {/* Arrachage chromatique cyan / magenta */}
        <div style={tear('rgba(0,229,255,0.85)', 'crt-tear-a')} />
        <div style={tear('rgba(255,0,193,0.85)', 'crt-tear-b')} />
        {/* Scanlines roulantes plein écran */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,229,255,0.10) 3px, rgba(0,0,0,0) 4px)',
            animation: active ? `crt-scan 500ms linear infinite` : 'none',
            opacity: active ? 1 : 0,
          }}
        />

        {/* 3. Ligne de phosphore + point (blanc à cœur, halo cyan) — au-dessus de tout */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 4,
            transform: 'translateY(-50%) scaleX(0)',
            background: CORE,
            boxShadow: `0 0 6px 1px ${CORE}, 0 0 22px 4px ${HALO}, 0 0 60px 10px ${HALO}`,
            opacity: 0,
            animation: lineAnim,
          }}
        />
      </div>
    </>
  );
}
