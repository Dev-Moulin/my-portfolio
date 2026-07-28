/**
 * CardScrollHint — démonstration animée pour l'étape « écran holo » du tuto (essai de la carte).
 *
 * Montre le geste complet : cliquer la carte → faire défiler le contenu → cliquer à l'extérieur.
 * Un pointeur mime le geste de la PHASE courante ; la barre latérale se remplit avec le défilement réel
 * (`scrollCharge`) ; trois pastilles se cochent (vert) au fur et à mesure (opened/scrolled/closed).
 *
 * Device-aware (retour Paul) : CURSEUR (desktop) / DOIGT (mobile). Les phases de CLIC (ouvrir / fermer)
 * ont un vrai feedback de clic : le pointeur descend, RÉTRÉCIT au contact, et des ONDES concentriques
 * partent du point de contact. Style cohérent avec MouseScrollHint / LookAroundHint (SVG inline, cyan/vert).
 */

const ACCENT = '#00d0fa'; // cyan (thème)
const DONE = '#4dff66';   // vert néon « sabre » (validation)

interface CardScrollHintProps {
  opened: boolean;
  scrolled: boolean;
  closed: boolean;
  scrollCharge: number; // 0..1 — défilement réel du contenu avant validation
  coarse?: boolean;     // mobile → doigt au lieu du curseur
}

const CSS = `
@keyframes csh-lines { 0%{transform:translateY(0)} 100%{transform:translateY(-12px)} }
@keyframes csh-drag { 0%,100%{transform:translateY(-5px)} 50%{transform:translateY(6px)} }
@keyframes csh-ready { 0%,100%{filter:drop-shadow(0 0 4px ${DONE}90)} 50%{filter:drop-shadow(0 0 13px ${DONE})} }
/* Clic : descente puis RÉTRÉCISSEMENT bref au contact (~46%). */
@keyframes csh-click {
  0%{transform:translateY(-6px) scale(1)} 38%{transform:translateY(0) scale(1)}
  46%{transform:translateY(0) scale(0.8)} 60%{transform:translateY(0) scale(1)}
  100%{transform:translateY(-6px) scale(1)}
}
/* Ondes concentriques émises au moment du contact. */
@keyframes csh-wave { 0%,40%{transform:scale(0.2);opacity:0} 49%{opacity:0.85} 100%{transform:scale(1);opacity:0} }
`;

/** Curseur pointeur, hotspot en (0,0) → positionné par le <g> parent. */
function Cursor({ col }: { col: string }) {
  return (
    <path d="M0,0 L0,16 L4.5,12 L7.5,18 L9.5,17 L6.5,11 L11,11 Z"
      fill={col} stroke="#04141d" strokeWidth={0.8} strokeLinejoin="round"
      style={{ filter: `drop-shadow(0 0 4px ${col})` }} />
  );
}

/** Doigt (mobile), hotspot (bout du doigt) ≈ (0,0). */
function Finger({ col }: { col: string }) {
  return (
    <g style={{ filter: `drop-shadow(0 0 4px ${col})` }}>
      <circle cx={0} cy={1} r={5} fill={col} stroke="#04141d" strokeWidth={0.9} />
      <rect x={-2.3} y={3} width={4.6} height={9} rx={2.3} fill={col} stroke="#04141d" strokeWidth={0.9} />
    </g>
  );
}

/** Pastille d'étape (numérotée) : validée = disque vert + check ; sinon contour cyan. */
function StepDot({ cx, n, done, active }: { cx: number; n: number; done: boolean; active: boolean }) {
  const col = done ? DONE : ACCENT;
  return (
    <g transform={`translate(${cx},104)`} style={{ animation: active && !done ? 'csh-ready 1.2s ease-in-out infinite' : 'none' }}>
      <circle r={7} fill={done ? DONE : 'rgba(4,12,20,0.9)'} stroke={col} strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 ${done || active ? 6 : 2}px ${col})` }} />
      {done ? (
        <path d="M-3,0 L-1,2.6 L3.2,-2.4" fill="none" stroke="#04141d" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <text x={0} y={3.2} textAnchor="middle" fontSize={9} fontWeight={700} fill={col} fontFamily="inherit">{n}</text>
      )}
    </g>
  );
}

export default function CardScrollHint({ opened, scrolled, closed, scrollCharge, coarse = false }: CardScrollHintProps) {
  const phase: 'open' | 'scroll' | 'close' | 'done' =
    !opened ? 'open' : !scrolled ? 'scroll' : !closed ? 'close' : 'done';
  const allDone = opened && scrolled && closed;
  const charge = Math.max(0, Math.min(1, scrolled ? 1 : scrollCharge));
  const Pointer = coarse ? Finger : Cursor;

  // Point de contact du geste courant (hotspot du pointeur).
  const pt =
    phase === 'open' ? { x: 54, y: 42 }      // sur la carte
    : phase === 'scroll' ? { x: 54, y: 38 }  // sur la carte (drag vertical)
    : phase === 'close' ? { x: 98, y: 92 }   // à l'extérieur
    : null;
  const isClick = phase === 'open' || phase === 'close';
  const cardCol = phase === 'open' ? ACCENT : allDone ? DONE : ACCENT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10 }}>
      <style>{CSS}</style>
      <svg width={124} height={118} viewBox="0 0 124 118" style={{ overflow: 'visible', animation: allDone ? 'csh-ready 1.3s ease-in-out infinite' : 'none' }}>
        <defs>
          <clipPath id="csh-card-clip"><rect x={30} y={20} width={50} height={58} rx={6} /></clipPath>
        </defs>

        {/* Carte holo */}
        <rect x={30} y={20} width={50} height={58} rx={6} fill="rgba(6,16,24,0.92)" stroke={cardCol} strokeWidth={1.6}
          style={{ filter: `drop-shadow(0 0 6px ${cardCol}70)` }} />

        {/* Lignes de « texte » — défilent pendant la phase scroll */}
        <g clipPath="url(#csh-card-clip)">
          <g style={{ animation: phase === 'scroll' ? 'csh-lines 1.5s linear infinite' : 'none' }}>
            {[28, 37, 46, 55, 64, 73, 82].map((y, i) => (
              <rect key={y} x={36} y={y} width={i % 3 === 2 ? 24 : 38} height={3} rx={1.5} fill={`${ACCENT}${phase === 'scroll' ? 'cc' : '66'}`} />
            ))}
          </g>
        </g>

        {/* Barre de défilement latérale — se remplit avec le scroll réel */}
        <rect x={84} y={20} width={6} height={58} rx={3} fill="rgba(255,255,255,0.08)" stroke={`${ACCENT}55`} strokeWidth={1} />
        <rect x={84} y={78 - charge * 58} width={6} height={charge * 58} rx={3}
          fill={scrolled ? DONE : ACCENT} style={{ filter: `drop-shadow(0 0 5px ${scrolled ? DONE : ACCENT})`, transition: 'height 120ms linear, y 120ms linear' }} />

        {/* Geste de la phase courante */}
        {pt && (
          <g transform={`translate(${pt.x},${pt.y})`}>
            {/* Ondes concentriques au contact (phases de clic uniquement) */}
            {isClick && (
              <>
                <circle r={13} fill="none" stroke={ACCENT} strokeWidth={1.5}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'csh-wave 1.4s ease-out infinite' }} />
                <circle r={13} fill="none" stroke={ACCENT} strokeWidth={1.1}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'csh-wave 1.4s ease-out infinite', animationDelay: '0.22s' }} />
              </>
            )}
            {/* Pointeur : clic (descente + rétrécissement) ou drag vertical (scroll) */}
            <g style={{
              transformBox: 'fill-box', transformOrigin: 'top left',
              animation: isClick ? 'csh-click 1.4s ease-in-out infinite' : 'csh-drag 1.4s ease-in-out infinite',
            }}>
              <Pointer col={ACCENT} />
            </g>
          </g>
        )}

        {/* 3 pastilles d'étape */}
        <StepDot cx={34} n={1} done={opened} active={phase === 'open'} />
        <StepDot cx={62} n={2} done={scrolled} active={phase === 'scroll'} />
        <StepDot cx={90} n={3} done={closed} active={phase === 'close'} />
      </svg>
    </div>
  );
}
