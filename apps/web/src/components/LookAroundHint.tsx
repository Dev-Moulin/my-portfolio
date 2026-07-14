/**
 * LookAroundHint — globe isométrique + œil de l'Overmind pour l'étape « regarder autour ».
 *
 * Une sphère filaire (360°) avec l'œil au centre, et une **main qui orbite autour de la sphère** :
 * elle avance (ouverte), puis à intervalles **se ferme et tire** (drag) — l'œil la suit du regard
 * (« et hop, ça décale »). Montre le geste clic-glisser sans bouger la vraie caméra (pas de mal de mer).
 *
 * `charge` (0..1) remplit l'anneau de progression avec l'amplitude du geste réel ; `done` illumine en vert.
 */

const ACCENT = '#00d0fa'; // cyan (thème)
const DONE = '#4dff66';   // vert néon « sabre » (validation, cohérent avec le tuto scroll)

const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R; // circonférence de l'anneau de charge
const ORBIT = 47;                    // rayon d'orbite de la main (hors sphère)

interface LookAroundHintProps {
  done: boolean;
  charge: number; // 0..1 — amplitude du geste réel avant validation
}

// La main orbite (8 s) ; toutes les 2 s elle « attrape et tire » (bascule ouverte↔poing + petite
// traction radiale). L'iris de l'œil suit la main sur la même orbite (trajectoire réduite).
const CSS = `
@keyframes lah-orbit {
  0%{transform:translate(${ORBIT}px,0)} 12.5%{transform:translate(${ORBIT * 0.71}px,${-ORBIT * 0.71}px)}
  25%{transform:translate(0,${-ORBIT}px)} 37.5%{transform:translate(${-ORBIT * 0.71}px,${-ORBIT * 0.71}px)}
  50%{transform:translate(${-ORBIT}px,0)} 62.5%{transform:translate(${-ORBIT * 0.71}px,${ORBIT * 0.71}px)}
  75%{transform:translate(0,${ORBIT}px)} 87.5%{transform:translate(${ORBIT * 0.71}px,${ORBIT * 0.71}px)}
  100%{transform:translate(${ORBIT}px,0)}
}
@keyframes lah-iris {
  0%{transform:translate(4px,0)} 12.5%{transform:translate(2.8px,-2.8px)} 25%{transform:translate(0,-4px)}
  37.5%{transform:translate(-2.8px,-2.8px)} 50%{transform:translate(-4px,0)} 62.5%{transform:translate(-2.8px,2.8px)}
  75%{transform:translate(0,4px)} 87.5%{transform:translate(2.8px,2.8px)} 100%{transform:translate(4px,0)}
}
@keyframes lah-hand-open { 0%,42%{opacity:1} 50%,82%{opacity:0} 90%,100%{opacity:1} }
@keyframes lah-hand-fist { 0%,42%{opacity:0} 50%,82%{opacity:1} 90%,100%{opacity:0} }
@keyframes lah-tug { 0%,42%{transform:translateY(0)} 62%{transform:translateY(4px)} 82%,100%{transform:translateY(0)} }
@keyframes lah-arrow { 0%,100%{opacity:.22} 50%{opacity:.55} }
@keyframes lah-ready { 0%,100%{filter:drop-shadow(0 0 4px ${DONE}90)} 50%{filter:drop-shadow(0 0 13px ${DONE})} }
`;

/** Chevron cardinal (discret) — rappelle « toutes les directions ». */
function Arrow({ pts, col, delay }: { pts: string; col: string; delay: string }) {
  return (
    <polyline points={pts} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: `lah-arrow 2s ease-in-out ${delay} infinite`, filter: `drop-shadow(0 0 4px ${col})` }} />
  );
}

/** Main « grab » ouverte (doigts tendus) — dessin stylisé centré sur (60,62). */
function HandOpen({ col }: { col: string }) {
  return (
    <g stroke={col} strokeWidth={1.4} fill="rgba(5,14,22,0.92)" strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: `drop-shadow(0 0 5px ${col}cc)` }}>
      <rect x={55} y={60} width={10} height={11} rx={4} />
      {/* 4 doigts */}
      <rect x={55.4} y={51} width={2} height={11} rx={1} />
      <rect x={57.8} y={49.5} width={2} height={12.5} rx={1} />
      <rect x={60.2} y={49.5} width={2} height={12.5} rx={1} />
      <rect x={62.6} y={51} width={2} height={11} rx={1} />
      {/* pouce */}
      <rect x={51.5} y={60} width={5.5} height={2.3} rx={1.15} transform="rotate(-28 54 61)" />
    </g>
  );
}

/** Main « grab » fermée (poing) — doigts repliés, plus compacte. */
function HandFist({ col }: { col: string }) {
  return (
    <g stroke={col} strokeWidth={1.4} fill="rgba(5,14,22,0.92)" strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: `drop-shadow(0 0 6px ${col})` }}>
      <rect x={55} y={58.5} width={10} height={11.5} rx={5} />
      {/* doigts repliés (petites bosses) */}
      <rect x={55.6} y={56} width={2} height={4} rx={1} />
      <rect x={57.9} y={55.5} width={2} height={4.5} rx={1} />
      <rect x={60.1} y={55.5} width={2} height={4.5} rx={1} />
      <rect x={62.4} y={56} width={2} height={4} rx={1} />
      {/* pouce replié */}
      <rect x={52.6} y={61} width={4.2} height={2.4} rx={1.2} />
    </g>
  );
}

export default function LookAroundHint({ done, charge }: LookAroundHintProps) {
  const col = done ? DONE : ACCENT;
  const fill = done ? 1 : Math.max(0, Math.min(1, charge));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10 }}>
      <style>{CSS}</style>
      <svg width={118} height={118} viewBox="0 0 120 120" style={{ overflow: 'visible', animation: done ? 'lah-ready 1.3s ease-in-out infinite' : 'none' }}>

        {/* 4 flèches cardinales (discrètes) */}
        <g>
          <Arrow pts="53,15 60,8 67,15" col={col} delay="0s" />
          <Arrow pts="53,105 60,112 67,105" col={col} delay="1s" />
          <Arrow pts="15,53 8,60 15,67" col={col} delay="0.5s" />
          <Arrow pts="105,53 112,60 105,67" col={col} delay="1.5s" />
        </g>

        {/* Sphère filaire (globe) */}
        <g stroke={col} fill="none" strokeWidth={1.5} opacity={0.9} style={{ filter: `drop-shadow(0 0 5px ${col}70)` }}>
          <circle cx={60} cy={60} r={34} />
          <ellipse cx={60} cy={60} rx={12} ry={34} />
          <ellipse cx={60} cy={60} rx={25} ry={34} opacity={0.45} />
          <ellipse cx={60} cy={60} rx={34} ry={12} />
        </g>

        {/* Anneau de charge (amplitude du geste réel) → se remplit puis passe au vert quand validé */}
        <circle cx={60} cy={60} r={RING_R} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - fill)} strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 250ms ease', filter: `drop-shadow(0 0 5px ${col})` }} />

        {/* Œil de l'Overmind : sclère fixe, iris qui SUIT la main (regarde vers elle) */}
        <g>
          <ellipse cx={60} cy={60} rx={15} ry={10} fill="rgba(4,12,20,0.88)" stroke={col} strokeWidth={1.4} />
          <g style={{ animation: done ? 'none' : 'lah-iris 8s ease-in-out infinite' }}>
            <circle cx={60} cy={60} r={5.6} fill={col} style={{ filter: `drop-shadow(0 0 4px ${col})` }} />
            <circle cx={60} cy={60} r={2.4} fill="#04141d" />
          </g>
        </g>

        {/* Main qui ORBITE autour de la sphère et TIRE par à-coups (drag) */}
        {!done && (
          <g style={{ animation: 'lah-orbit 8s linear infinite' }}>
            <g style={{ animation: 'lah-tug 2s ease-in-out infinite' }}>
              <g style={{ animation: 'lah-hand-open 2s ease-in-out infinite' }}><HandOpen col={ACCENT} /></g>
              <g style={{ animation: 'lah-hand-fist 2s ease-in-out infinite' }}><HandFist col={ACCENT} /></g>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
