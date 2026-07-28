/**
 * NavArcHint — illustration animée pour l'étape « navarc » du tuto (comme MouseScrollHint /
 * CardScrollHint). Montre la NavArc, le bouton LANGUE mis en avant (globe), et le geste à faire.
 *
 * Deux versions, fidèles à la VRAIE disposition de l'arc et au geste réel :
 *  • DESKTOP : arc ouvert, curseur qui va cliquer la langue (DERNIER bouton, bas-droite). Le
 *    mouseleave referme tout seul → pas besoin de montrer la fermeture.
 *  • MOBILE : cycle en 3 temps — tap centre (ouvre) → tap langue (~36°, avant-dernière) → tap centre
 *    (referme). Au doigt il n'y a pas de mouseleave → on montre explicitement la fermeture.
 */
const ACCENT = '#00d0fa';
const DONE = '#4dff7a'; // vert de validation (langue testée)

// Disposition réelle (centre 65,76 · rayon 40).
const DESK_GREY: [number, number][] = [[25, 76], [36.7, 47.7], [65, 36], [93.3, 47.7]];
const DESK_LANG: [number, number] = [105, 76]; // dernier bouton, tout en bas à droite
const MOB_GREY: [number, number][] = [[25, 76], [32.6, 52.5], [52.6, 38], [77.4, 38], [105, 76]]; // 105,76 = gyro
const MOB_LANG: [number, number] = [97.4, 52.5];

const CSS = `
@keyframes nah-lang { 0%,100%{filter:drop-shadow(0 0 3px ${ACCENT}90)} 50%{filter:drop-shadow(0 0 10px ${ACCENT})} }

/* ── Desktop : curseur → langue (bas-droite) ── */
@keyframes nah-ripple { 0%,54%{transform:scale(0);opacity:0} 62%{transform:scale(.25);opacity:.85} 82%{transform:scale(1);opacity:0} 100%{transform:scale(1);opacity:0} }
@keyframes nah-cur-desk {
  0%{transform:translate(56px,84px);opacity:0} 14%{opacity:1}
  46%{transform:translate(101px,70px);opacity:1} 58%{transform:translate(101px,70px)}
  64%{transform:translate(101px,73px)} 72%{transform:translate(101px,70px)}
  88%{transform:translate(101px,70px);opacity:1} 100%{transform:translate(56px,84px);opacity:0}
}

/* ── Mobile : cycle 3 temps (tap centre → tap langue → tap centre) ── */
@keyframes nah-mob-arc { 0%,17%{opacity:0} 22%{opacity:1} 57%{opacity:1} 62%,100%{opacity:0} }
@keyframes nah-fing-mob {
  0%{transform:translate(54px,84px);opacity:0} 8%{opacity:1}
  16%{transform:translate(63px,74px)} 19%{transform:translate(63px,77px)} 23%{transform:translate(63px,74px)}
  38%{transform:translate(93px,47px)} 41%{transform:translate(93px,50px)} 45%{transform:translate(93px,47px)}
  56%{transform:translate(63px,74px)} 59%{transform:translate(63px,77px)} 63%{transform:translate(63px,74px)}
  70%{transform:translate(54px,84px);opacity:1} 76%{opacity:0} 100%{transform:translate(54px,84px);opacity:0}
}
@keyframes nah-rip-c {
  0%,14%{transform:scale(0);opacity:0} 18%{transform:scale(.25);opacity:.85} 30%{transform:scale(1);opacity:0}
  54%{transform:scale(0);opacity:0} 58%{transform:scale(.25);opacity:.85} 70%{transform:scale(1);opacity:0} 100%{transform:scale(1);opacity:0}
}
@keyframes nah-rip-l { 0%,36%{transform:scale(0);opacity:0} 40%{transform:scale(.25);opacity:.85} 54%{transform:scale(1);opacity:0} 100%{transform:scale(1);opacity:0} }
`;

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={7} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.26)" strokeWidth={1.2} />;
}

function LangGlobe({ x, y, done = false }: { x: number; y: number; done?: boolean }) {
  const col = done ? DONE : ACCENT;
  return (
    <g style={{ animation: done ? 'none' : 'nah-lang 1.4s ease-in-out infinite' }}>
      <circle cx={x} cy={y} r={8.5} fill={`${col}22`} stroke={col} strokeWidth={1.8} style={done ? { filter: `drop-shadow(0 0 5px ${DONE})` } : undefined} />
      {done ? (
        // Validé → coche verte à la place du globe.
        <path d={`M ${x - 4} ${y} l 2.6 3.2 l 5.4 -6.6`} fill="none" stroke={DONE} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx={x} cy={y} r={4.6} fill="none" stroke={col} strokeWidth={0.9} />
          <line x1={x - 4.6} y1={y} x2={x + 4.6} y2={y} stroke={col} strokeWidth={0.8} />
          <ellipse cx={x} cy={y} rx={2.2} ry={4.6} fill="none" stroke={col} strokeWidth={0.8} />
        </>
      )}
    </g>
  );
}

function Ripple({ x, y, anim }: { x: number; y: number; anim: string }) {
  return (
    <circle cx={x} cy={y} r={10} fill="none" stroke={ACCENT} strokeWidth={1.5}
      style={{ animation: anim, transformBox: 'fill-box', transformOrigin: 'center' }} />
  );
}

const Cursor = () => (
  <path d="M0 0 L0 15 L4.2 11 L7.2 16.6 L9.4 15.5 L6.4 10 L11.6 9.6 Z" fill="#dff6ff" stroke="#04121a" strokeWidth={0.8} />
);
const Finger = () => (
  <g transform="translate(-6, -2)">
    <circle cx={0} cy={0} r={5.5} fill="#dff6ff" stroke="#04121a" strokeWidth={0.9} />
    <rect x={-2.4} y={2} width={4.8} height={9} rx={2.4} fill="#dff6ff" stroke="#04121a" strokeWidth={0.9} />
  </g>
);

interface NavArcHintProps { coarse?: boolean; langTested?: boolean }

export default function NavArcHint({ coarse = false, langTested = false }: NavArcHintProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
      <style>{CSS}</style>
      <svg width={132} height={94} viewBox="0 0 132 94" style={{ overflow: 'visible' }}>
        {/* arc guide léger (pointillé) */}
        <path d="M 25 76 A 40 40 0 0 1 105 76" fill="none" stroke={`${ACCENT}33`} strokeWidth={1.2} strokeDasharray="3 4" />
        {/* bouton central */}
        <circle cx={65} cy={76} r={9} fill="rgba(255,255,255,0.10)" stroke={`${ACCENT}80`} strokeWidth={1.4} />

        {coarse ? (
          <>
            {/* Arc — destinations grisées + langue. Validé (langTested) → arc figé + globe vert ✓, on
                retire la démo du geste (doigt/ondes) puisque c'est fait. */}
            <g style={langTested ? undefined : { animation: 'nah-mob-arc 5s ease-in-out infinite' }}>
              {MOB_GREY.map(([x, y], i) => <Dot key={i} x={x} y={y} />)}
              <LangGlobe x={MOB_LANG[0]} y={MOB_LANG[1]} done={langTested} />
            </g>
            {!langTested && (
              <>
                {/* ondes de tap : centre (ouvre + ferme) et langue (change) */}
                <Ripple x={65} y={76} anim="nah-rip-c 5s ease-out infinite" />
                <Ripple x={MOB_LANG[0]} y={MOB_LANG[1]} anim="nah-rip-l 5s ease-out infinite" />
                {/* doigt : centre → langue → centre */}
                <g style={{ animation: 'nah-fing-mob 5s ease-in-out infinite' }}><Finger /></g>
              </>
            )}
          </>
        ) : (
          <>
            {DESK_GREY.map(([x, y], i) => <Dot key={i} x={x} y={y} />)}
            <LangGlobe x={DESK_LANG[0]} y={DESK_LANG[1]} done={langTested} />
            {!langTested && (
              <>
                <Ripple x={DESK_LANG[0]} y={DESK_LANG[1]} anim="nah-ripple 3s ease-out infinite" />
                <g style={{ animation: 'nah-cur-desk 3s ease-in-out infinite' }}><Cursor /></g>
              </>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
