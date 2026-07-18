import { useEffect, useState } from 'react';

type RestPoint = 'A' | 'B' | 'C' | 'D' | 'E';

interface GaugeDetail {
  state?: string;
  to?: RestPoint;
  trigger?: 'scroll' | 'nav';
}

const LABELS: Record<'fr' | 'en', string> = { fr: 'Passer', en: 'Skip' };

// Le GLOW du bouton vient désormais de la 3D (bulle émissive captée par le bloom, cf. skipGlowSystem).
// Ici : seulement le TEXTE net (mot blanc + burst glitch) et les chevrons « ❮❮ … ❯❯ » animés (poussés
// vers l'extérieur ensemble, puis retour séquentiel : intérieur d'abord, extérieur en différé).
const SKIP_CSS = `
@keyframes skip-chevL-in {
  0%   { transform: translateX(0);    opacity: 0.6; }
  22%  { transform: translateX(-6px); opacity: 1; }
  50%  { transform: translateX(0);    opacity: 0.6; }
  100% { transform: translateX(0);    opacity: 0.6; }
}
@keyframes skip-chevL-out {
  0%   { transform: translateX(0);     opacity: 0.6; }
  22%  { transform: translateX(-12px); opacity: 1; }
  70%  { transform: translateX(-12px); opacity: 1; }
  100% { transform: translateX(0);     opacity: 0.6; }
}
@keyframes skip-chevR-in {
  0%   { transform: translateX(0);   opacity: 0.6; }
  22%  { transform: translateX(6px); opacity: 1; }
  50%  { transform: translateX(0);   opacity: 0.6; }
  100% { transform: translateX(0);   opacity: 0.6; }
}
@keyframes skip-chevR-out {
  0%   { transform: translateX(0);    opacity: 0.6; }
  22%  { transform: translateX(12px); opacity: 1; }
  70%  { transform: translateX(12px); opacity: 1; }
  100% { transform: translateX(0);    opacity: 0.6; }
}
@keyframes skip-glitch {
  0%, 70%, 100% { transform: translate(0,0); text-shadow: none; }
  72% { transform: translate(-6px, 2px); text-shadow: -7px 0 #ff00c1, 7px 0 #00fff9; }
  75% { transform: translate(6px, -2px); text-shadow:  7px 0 #ff00c1, -7px 0 #00fff9; }
  78% { transform: translate(-5px, 1px); text-shadow: -6px 0 #ff00c1, 6px 0 #00fff9; }
  81% { transform: translate(5px, -1px); text-shadow:  6px 0 #ff00c1, -6px 0 #00fff9; }
  84% { transform: translate(-3px, 2px); text-shadow: -4px 0 #ff00c1, 4px 0 #00fff9; }
  87% { transform: translate(3px, 0);    text-shadow:  3px 0 #ff00c1, -3px 0 #00fff9; }
  90% { transform: translate(0, 0);      text-shadow: none; }
}
`;

// Typo partagée par le mot net ET ses copies-halo (elles doivent se superposer au pixel près).
const wordType: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 3,
  lineHeight: 1,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const chev: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'monospace',
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
  color: '#ffffff', // blanc → lisible par-dessus le glow cyan de la bulle 3D
  textShadow: '0 1px 3px rgba(0,0,0,0.55)', // léger contour sombre pour se détacher du halo
};

/**
 * SkipButton — bouton « passer le trajet » (coin haut-droite). Rendu SANS cadre : mot net (+ burst
 * glitch) et chevrons animés ; le GLOW vient de la bulle 3D derrière (skipGlowSystem, captée par le
 * bloom). Visible UNIQUEMENT pendant un trajet caméra déclenché par la NavArc (`state === 'playing'`
 * ET `trigger === 'nav'`). Clic → téléportation vers la destination (`to`), masquée par le CRT.
 */
export function SkipButton() {
  const [visible, setVisible] = useState(false);
  const [to, setTo] = useState<RestPoint>('A');
  const [lang, setLang] = useState<'fr' | 'en'>(() =>
    (typeof document !== 'undefined' && document.documentElement.lang === 'en') ? 'en' : 'fr',
  );

  useEffect(() => {
    const onGauge = (e: Event) => {
      const d = (e as CustomEvent<GaugeDetail>).detail;
      const shown = d?.state === 'playing' && d?.trigger === 'nav';
      setVisible(shown);
      if (shown && d?.to) setTo(d.to);
    };
    const onLang = (e: Event) => {
      setLang((e as CustomEvent<string>).detail === 'en' ? 'en' : 'fr');
    };
    window.addEventListener('overmind:scroll-gauge-update', onGauge);
    window.addEventListener('overmind:language-change', onLang);
    return () => {
      window.removeEventListener('overmind:scroll-gauge-update', onGauge);
      window.removeEventListener('overmind:language-change', onLang);
    };
  }, []);

  const onSkip = () => {
    window.dispatchEvent(new CustomEvent('overmind:nav-transition', { detail: to }));
  };

  const anim = (name: string) => (visible ? `${name} 1.4s ease-in-out infinite` : 'none');
  const word = LABELS[lang];

  return (
    <>
      <style>{SKIP_CSS}</style>
      <button
        type="button"
        onClick={onSkip}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        title={word}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          // Bouton d'action VISITEUR → doit passer au-dessus de tous les overlays (conteneurs NavArc
          // en portal z≤1000, panneaux dev transparents). Cf. bug « seul le “P” cliquable ».
          zIndex: 9998,
          background: 'none', // plus de fond : le glow vient de la bulle 3D, le texte reste net par-dessus
          border: 'none',
          padding: '14px 22px', // agrandit seulement la zone CLIQUABLE (invisible)
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center', // contenu CENTRÉ dans la boîte…
          gap: 8,
          minWidth: 200,            // …de largeur fixe → PASSER et SKIP partagent le MÊME centre (aligné à la bulle)
          cursor: 'pointer',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-8px)',
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 220ms ease, transform 220ms ease',
        }}
      >
        {/* Groupe gauche : extérieur puis intérieur. */}
        <span aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ ...chev, animation: anim('skip-chevL-out') }}>❮</span>
          <span style={{ ...chev, animation: anim('skip-chevL-in') }}>❮</span>
        </span>

        {/* Mot net (blanc + burst glitch). Le glow est fourni par la bulle 3D derrière. */}
        <span
          style={{
            ...wordType,
            display: 'inline-block',
            color: '#ffffff',
            textShadow: '0 1px 3px rgba(0,0,0,0.55)', // léger contour sombre → lisible sur le glow
            animation: visible ? 'skip-glitch 2.6s steps(20, end) infinite' : 'none',
          }}
        >
          {word}
        </span>

        {/* Groupe droit : intérieur puis extérieur. */}
        <span aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ ...chev, animation: anim('skip-chevR-in') }}>❯</span>
          <span style={{ ...chev, animation: anim('skip-chevR-out') }}>❯</span>
        </span>
      </button>
    </>
  );
}
