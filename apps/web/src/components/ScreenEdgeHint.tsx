import { useEffect, useState, type CSSProperties } from 'react';

/**
 * ScreenEdgeHint — bandeau lumineux plein écran pour l'étape « bords d'écran » du tuto B.
 *
 * Un halo de bord (4 dégradés + cadre) pulse tout autour de l'écran avec 4 chevrons pointant vers
 * l'extérieur, pour inviter à approcher la souris d'un bord (regard latéral léger). Validé → passe au
 * vert et cesse de pulser. Piloté par l'event `overmind:onboarding` (detail.edge {active, done}).
 */

interface EdgeState { active: boolean; done: boolean }
const NO_EDGE: EdgeState = { active: false, done: false };

const ACCENT_RGB = '0,208,250'; // cyan
const DONE_RGB = '77,255,102';  // vert néon « sabre » (validation)
const BAND = 84;                // épaisseur du dégradé de bord (px)

const CSS = `@keyframes seh-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`;

/** Chevron pointant vers l'extérieur, placé au milieu d'un bord. */
function EdgeChevron({ pos, rot, col }: { pos: CSSProperties; rot: number; col: string }) {
  return (
    <div style={{ position: 'absolute', ...pos }}>
      <svg width={30} height={19} viewBox="0 0 30 19" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }}>
        <polyline points="4,16 15,5 26,16" fill="none" stroke={col} strokeWidth={2.6}
          strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
      </svg>
    </div>
  );
}

export default function ScreenEdgeHint() {
  const [edge, setEdge] = useState<EdgeState>(NO_EDGE);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ edge?: EdgeState }>).detail?.edge;
      setEdge(d?.active ? d : NO_EDGE);
    };
    window.addEventListener('overmind:onboarding', on);
    return () => window.removeEventListener('overmind:onboarding', on);
  }, []);

  const rgb = edge.done ? DONE_RGB : ACCENT_RGB;
  const col = `rgb(${rgb})`;
  const anim = edge.done ? 'none' : 'seh-pulse 1.4s ease-in-out infinite';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none',
      opacity: edge.active ? 1 : 0, transition: 'opacity 300ms ease',
    }}>
      <style>{CSS}</style>

      {/* Cadre + halo intérieur */}
      <div style={{
        position: 'absolute', inset: 0,
        border: `2px solid rgba(${rgb},0.7)`,
        boxShadow: `inset 0 0 70px rgba(${rgb},0.45), inset 0 0 20px rgba(${rgb},0.6)`,
        animation: anim,
      }} />

      {/* 4 dégradés de bord */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BAND, background: `linear-gradient(to bottom, rgba(${rgb},0.42), rgba(${rgb},0))`, animation: anim }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: BAND, background: `linear-gradient(to top, rgba(${rgb},0.42), rgba(${rgb},0))`, animation: anim }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: BAND, background: `linear-gradient(to right, rgba(${rgb},0.42), rgba(${rgb},0))`, animation: anim }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: BAND, background: `linear-gradient(to left, rgba(${rgb},0.42), rgba(${rgb},0))`, animation: anim }} />

      {/* 4 chevrons vers l'extérieur */}
      <div style={{ animation: anim }}>
        <EdgeChevron pos={{ top: 16, left: '50%', transform: 'translateX(-50%)' }} rot={0} col={col} />
        <EdgeChevron pos={{ bottom: 16, left: '50%', transform: 'translateX(-50%)' }} rot={180} col={col} />
        <EdgeChevron pos={{ left: 16, top: '50%', transform: 'translateY(-50%)' }} rot={-90} col={col} />
        <EdgeChevron pos={{ right: 16, top: '50%', transform: 'translateY(-50%)' }} rot={90} col={col} />
      </div>
    </div>
  );
}
