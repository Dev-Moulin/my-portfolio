/**
 * GyroHint — illustration animée de l'étape « regarder autour » MOBILE (gyroscope, PR F1).
 * Pendant de LookAroundHint (desktop, souris). Deux TEMPS, fidèles au parcours réel (retour Paul) :
 *
 *  ① ACTIVER (gyro pas encore allumé) : on guide vers la NavArc — arc + bouton GYRO mis en avant (halo)
 *    + doigt qui tape dessus. « Ouvrez la NavArc, activez le gyroscope ». (Le vrai bouton pulse aussi.)
 *  ② UTILISER (gyro allumé) : un téléphone qui s'incline gauche/droite (le geste) + anneau de progression
 *    qui se remplit quand l'utilisateur bouge réellement (charge) → validation obligatoire du mouvement.
 *
 * Cas limites : capteur absent (unavailable) ou permission refusée (denied) → pictogramme neutre discret,
 * le texte de la bulle explique et l'étape devient franchissable au swipe.
 */
const ACCENT = '#00d0fa';
const MUTED = '#5a7482';
const R = 30;
const C = 2 * Math.PI * R;

// Géométrie de l'arc NavArc mobile (repère 132×94, centre 65,76 r40) — identique à NavArcHint.
const ARC_GREY: [number, number][] = [[25, 76], [32.6, 52.5], [52.6, 38], [77.4, 38], [97.4, 52.5]];
const GYRO_POS: [number, number] = [105, 76]; // bouton gyro = extrémité droite basse (dernier de l'arc)

const CSS = `
/* ── ① Activer : bouton gyro pulsé + doigt qui tape ── */
@keyframes gh-gyro { 0%,100%{filter:drop-shadow(0 0 3px ${ACCENT}90)} 50%{filter:drop-shadow(0 0 10px ${ACCENT})} }
@keyframes gh-rot  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes gh-fing { 0%{transform:translate(96px,84px);opacity:0} 12%{opacity:1}
  40%{transform:translate(101px,72px)} 48%{transform:translate(101px,75px)} 56%{transform:translate(101px,72px)}
  84%{transform:translate(101px,72px);opacity:1} 100%{transform:translate(96px,84px);opacity:0} }
@keyframes gh-rip  { 0%,34%{transform:scale(0);opacity:0} 42%{transform:scale(.3);opacity:.85} 60%{transform:scale(1);opacity:0} 100%{transform:scale(1);opacity:0} }
/* ── ② Utiliser : téléphone qui s'incline ── */
@keyframes gh-tilt { 0%,100%{transform:rotate(-13deg) translateX(-2px)} 50%{transform:rotate(13deg) translateX(2px)} }
@keyframes gh-look { 0%,100%{opacity:.35} 50%{opacity:.85} }
`;

function Finger() {
  return (
    <g transform="translate(-6,-2)">
      <circle cx={0} cy={0} r={5.5} fill="#dff6ff" stroke="#04121a" strokeWidth={0.9} />
      <rect x={-2.4} y={2} width={4.8} height={9} rx={2.4} fill="#dff6ff" stroke="#04121a" strokeWidth={0.9} />
    </g>
  );
}

/** Petit symbole gyroscope (cercle + flèche de rotation). */
function GyroGlyph({ x, y, r = 8.5 }: { x: number; y: number; r?: number }) {
  return (
    <g style={{ animation: 'gh-gyro 1.4s ease-in-out infinite' }}>
      <circle cx={x} cy={y} r={r} fill={`${ACCENT}22`} stroke={ACCENT} strokeWidth={1.8} />
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gh-rot 3.2s linear infinite' }}>
        <path d={`M ${x} ${y - 4.4} A 4.4 4.4 0 1 1 ${x - 4.4} ${y}`} fill="none" stroke={ACCENT} strokeWidth={1.3} strokeLinecap="round" />
        <path d={`M ${x} ${y - 4.4} l -2 -1.6 M ${x} ${y - 4.4} l 1.4 -2.2`} fill="none" stroke={ACCENT} strokeWidth={1.3} strokeLinecap="round" />
      </g>
    </g>
  );
}

interface GyroHintProps { enabled?: boolean; unavailable?: boolean; denied?: boolean; charge?: number }

export default function GyroHint({ enabled = false, unavailable = false, denied = false, charge = 0 }: GyroHintProps) {
  const inactive = unavailable || denied; // secours : capteur absent / permission refusée → pictogramme neutre
  const dash = C * (1 - Math.max(0, Math.min(1, charge)));

  // ── ② UTILISER (gyro allumé) OU cas limite : téléphone (incliné si actif, figé sinon) ──
  if (enabled || inactive) {
    const col = inactive ? MUTED : ACCENT;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <style>{CSS}</style>
        <svg width={96} height={84} viewBox="-48 -42 96 84" style={{ overflow: 'visible' }}>
          {!inactive && (
            <>
              <circle cx={0} cy={0} r={R} fill="none" stroke={`${ACCENT}22`} strokeWidth={3} />
              <circle cx={0} cy={0} r={R} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={dash} transform="rotate(-90)"
                style={{ transition: 'stroke-dashoffset 120ms linear', filter: `drop-shadow(0 0 4px ${ACCENT})` }} />
            </>
          )}
          <g style={{
            transformBox: 'fill-box', transformOrigin: 'center',
            animation: inactive ? 'none' : 'gh-tilt 2.6s ease-in-out infinite', opacity: inactive ? 0.5 : 1,
          }}>
            <rect x={-11} y={-19} width={22} height={38} rx={4.5} fill="rgba(10,18,26,0.9)" stroke={col} strokeWidth={1.8} />
            <rect x={-8} y={-15} width={16} height={27} rx={2} fill={`${col}1e`} stroke={`${col}66`} strokeWidth={0.8} />
            <circle cx={0} cy={15} r={1.6} fill={col} />
            {!inactive && (
              <g stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" fill="none" style={{ animation: 'gh-look 2.6s ease-in-out infinite' }}>
                <path d="M -20 -2 l -4 3 l 4 3" />
                <path d="M 20 -2 l 4 3 l -4 3" />
              </g>
            )}
          </g>
          {inactive && (
            <g stroke={MUTED} strokeWidth={2.4} strokeLinecap="round">
              <line x1={-16} y1={-16} x2={16} y2={16} />
            </g>
          )}
        </svg>
      </div>
    );
  }

  // ── ① ACTIVER (gyro éteint) : guider vers la NavArc → bouton gyro ──
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
      <style>{CSS}</style>
      <svg width={132} height={94} viewBox="0 0 132 94" style={{ overflow: 'visible' }}>
        {/* arc guide + bouton central (la NavArc) */}
        <path d="M 25 76 A 40 40 0 0 1 105 76" fill="none" stroke={`${ACCENT}33`} strokeWidth={1.2} strokeDasharray="3 4" />
        <circle cx={65} cy={76} r={9} fill="rgba(255,255,255,0.10)" stroke={`${ACCENT}80`} strokeWidth={1.4} />
        {/* destinations grisées */}
        {ARC_GREY.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={7} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.26)" strokeWidth={1.2} />
        ))}
        {/* bouton GYRO mis en avant */}
        <GyroGlyph x={GYRO_POS[0]} y={GYRO_POS[1]} />
        {/* onde de tap + doigt qui tape le gyro */}
        <circle cx={GYRO_POS[0]} cy={GYRO_POS[1]} r={11} fill="none" stroke={ACCENT} strokeWidth={1.5}
          style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gh-rip 2.4s ease-out infinite' }} />
        <g style={{ animation: 'gh-fing 2.4s ease-in-out infinite' }}><Finger /></g>
      </svg>
    </div>
  );
}
