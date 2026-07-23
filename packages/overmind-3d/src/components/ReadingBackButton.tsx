import { useEffect, useState } from 'react';

/**
 * ReadingBackButton — bouton « retour » de lecture, MOBILE/TABLETTE uniquement.
 *
 * En lecture zoomée sur petit écran, le tap-dehors est inatteignable (la carte remplit l'écran)
 * → ce bouton est le SEUL moyen de sortir : clic → `overmind:exit-reading` (écouté par
 * SceneRenderer → animator.exitReading() → dézoome + repasse en dwell → scroll rendu).
 *
 * Visible seulement si `reading-mode` actif ET pointeur grossier (doigt). Desktop : jamais monté
 * visuellement (la sortie y reste tap-dehors + Échap). Style calé sur le SkipButton (sans cadre :
 * chevron animé + mot net monospace majuscules), en miroir : haut-GAUCHE (le SkipButton est en
 * haut-droite ; ils ne coexistent jamais — reading vs playing). Le SkipButton tire son glow d'une
 * bulle 3D ; ici pas de bulle → halo cyan en text-shadow pour rester lisible sans bloc opaque.
 */
// Chevron « retour » : va-et-vient doux vers la gauche (attire l'œil vers la sortie).
const READBACK_CSS = `
@keyframes readback-chev {
  0%, 100% { transform: translateX(0);    opacity: 0.7; }
  50%      { transform: translateX(-6px); opacity: 1; }
}`;
const READBACK_GLOW = '0 0 12px rgba(0, 229, 255, 0.55), 0 1px 3px rgba(0, 0, 0, 0.6)';

export function ReadingBackButton() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<'fr' | 'en'>(() =>
    (typeof document !== 'undefined' && document.documentElement.lang === 'en') ? 'en' : 'fr',
  );

  useEffect(() => {
    const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    const onReading = (e: Event) => {
      const active = (e as CustomEvent<{ active: boolean }>).detail?.active === true;
      setVisible(coarse && active); // desktop (coarse=false) → jamais visible
    };
    const onLang = (e: Event) => setLang((e as CustomEvent<string>).detail === 'en' ? 'en' : 'fr');
    window.addEventListener('overmind:reading-mode', onReading);
    window.addEventListener('overmind:language-change', onLang);
    return () => {
      window.removeEventListener('overmind:reading-mode', onReading);
      window.removeEventListener('overmind:language-change', onLang);
    };
  }, []);

  const onBack = () => {
    setVisible(false); // disparition immédiate, sans attendre le prochain reading-mode
    window.dispatchEvent(new CustomEvent('overmind:exit-reading'));
  };

  return (
    <>
    <style>{READBACK_CSS}</style>
    <button
      type="button"
      onClick={onBack}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title={lang === 'en' ? 'Back' : 'Retour'}
      style={{
        position: 'fixed',
        top: 24,
        left: 24,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 22px', // agrandit la zone CLIQUABLE (tactile) sans cadre visible
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 220ms ease, transform 220ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: 'monospace',
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1,
          color: '#ffffff',
          textShadow: READBACK_GLOW,
          animation: visible ? 'readback-chev 1.4s ease-in-out infinite' : 'none',
        }}
      >
        ❮
      </span>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 3,
          lineHeight: 1,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: '#ffffff',
          textShadow: READBACK_GLOW,
        }}
      >
        {lang === 'en' ? 'Back' : 'Retour'}
      </span>
    </button>
    </>
  );
}
