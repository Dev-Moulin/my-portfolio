/**
 * MouseScrollHint — souris isométrique animée pour l'étape 1 du tuto (apprentissage du scroll).
 *
 * Montre le geste molette ↑ / ↓. Les chevrons haut/bas se COCHENT (vert) quand le sens a été
 * testé (props upDone / downDone). Quand les deux sont faits, la souris « respire » pour inviter
 * au dernier scroll de validation.
 *
 * Style « réaliste » (corps dégradé, reflet, molette ombrée) — retenu par Paul (2026-07-13).
 */

const ACCENT = '#00d0fa';
// Couleurs par POSITION (mêmes que les barres de scroll) : le remplissage suit le geste.
const UP_COLOR = '#00d0fa';   // scroll vers le HAUT → cyan (zone haute des barres)
const DOWN_COLOR = '#4dff66'; // scroll vers le BAS → vert néon « sabre » (zone basse des barres)

interface MouseScrollHintProps {
  upDone: boolean;
  downDone: boolean;
  awaiting: 'down' | 'up' | 'none'; // sens attendu (guidage) — met en avant la bonne flèche
}

const CSS = `
@keyframes msh-wheel { 0%,100%{transform:translateY(-3px)} 50%{transform:translateY(3px)} }
@keyframes msh-chev-up { 0%,100%{opacity:.4;transform:translateY(1px)} 50%{opacity:1;transform:translateY(-2px)} }
@keyframes msh-chev-dn { 0%,100%{opacity:.4;transform:translateY(-1px)} 50%{opacity:1;transform:translateY(2px)} }
@keyframes msh-ready { 0%,100%{filter:drop-shadow(0 0 3px ${ACCENT}90)} 50%{filter:drop-shadow(0 0 11px ${ACCENT})} }
`;

function Chevron({ dir, done, active }: { dir: 'up' | 'down'; done: boolean; active: boolean }) {
  // Couleur par position (haut = cyan, bas = vert). 3 états : validé (plein/vif), attendu (pulse),
  // en attente de son tour (estompé) → guide l'utilisateur vers le bon sens.
  const color = dir === 'up' ? UP_COLOR : DOWN_COLOR;
  const pts = dir === 'up' ? '3,10 11,3 19,10' : '3,3 11,10 19,3';
  const opacity = done ? 1 : active ? 1 : 0.26;
  return (
    <svg width={22} height={13} viewBox="0 0 22 13" style={{
      overflow: 'visible',
      opacity,
      animation: active && !done ? `msh-chev-${dir === 'up' ? 'up' : 'dn'} 1.15s ease-in-out infinite` : 'none',
    }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={done ? 3.2 : 2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 ${done || active ? 7 : 3}px ${color})` }}
      />
    </svg>
  );
}

/** Souris réaliste (corps dégradé, reflet, molette ombrée) — style retenu par Paul. */
function MouseRealistic({ ready }: { ready: boolean }) {
  return (
    <svg width={54} height={76} viewBox="0 0 64 92" style={{ animation: ready ? 'msh-ready 1.3s ease-in-out infinite' : 'none' }}>
      <defs>
        <linearGradient id="msh-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#31424e" />
          <stop offset="0.55" stopColor="#1a2732" />
          <stop offset="1" stopColor="#0c141d" />
        </linearGradient>
        <linearGradient id="msh-wheelg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ACCENT} />
          <stop offset="1" stopColor="#0a6d85" />
        </linearGradient>
      </defs>
      {/* ombre portée */}
      <ellipse cx={32} cy={85} rx={17} ry={4} fill="rgba(0,0,0,0.45)" />
      {/* corps */}
      <rect x={15} y={15} width={34} height={64} rx={17} fill="url(#msh-body)" stroke={`${ACCENT}80`} strokeWidth={1.3}
        style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }} />
      {/* reflet latéral */}
      <ellipse cx={26} cy={32} rx={7} ry={15} fill="rgba(255,255,255,0.10)" />
      {/* séparation des boutons */}
      <line x1={32} y1={17} x2={32} y2={40} stroke="rgba(220,246,255,0.28)" strokeWidth={1.2} />
      {/* molette animée */}
      <rect x={29} y={25} width={6} height={13} rx={3} fill="url(#msh-wheelg)" stroke={`${ACCENT}`} strokeWidth={0.6}
        style={{ animation: 'msh-wheel 1.5s ease-in-out infinite', filter: `drop-shadow(0 0 5px ${ACCENT})` }} />
    </svg>
  );
}

export default function MouseScrollHint({ upDone, downDone, awaiting }: MouseScrollHintProps) {
  const ready = upDone && downDone;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 10 }}>
      <style>{CSS}</style>
      <Chevron dir="up" done={upDone} active={awaiting === 'up'} />
      <MouseRealistic ready={ready} />
      <Chevron dir="down" done={downDone} active={awaiting === 'down'} />
    </div>
  );
}
