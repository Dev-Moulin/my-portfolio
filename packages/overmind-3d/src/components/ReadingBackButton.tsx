import { useEffect, useState } from 'react';

/**
 * ReadingBackButton — bouton « retour » de lecture, MOBILE/TABLETTE uniquement.
 *
 * En lecture zoomée sur petit écran, le tap-dehors est inatteignable (la carte remplit l'écran)
 * → ce bouton est le SEUL moyen de sortir : clic → `overmind:exit-reading` (écouté par
 * SceneRenderer → animator.exitReading() → dézoome + repasse en dwell → scroll rendu).
 *
 * Visible seulement si `reading-mode` actif ET pointeur grossier (doigt). Desktop : jamais monté
 * visuellement (la sortie y reste tap-dehors + Échap). Style raccord holo (sombre + halo cyan),
 * placé en haut-gauche (le SkipButton est en haut-droite ; ils ne coexistent jamais).
 */
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
    <button
      type="button"
      onClick={onBack}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title={lang === 'en' ? 'Back' : 'Retour'}
      style={{
        position: 'fixed',
        top: 20,
        left: 20,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 16px 9px 12px',
        background: 'rgba(4, 10, 16, 0.88)',
        color: '#ffffff',
        border: '1px solid rgba(0, 229, 255, 0.55)',
        borderRadius: 8,
        boxShadow: '0 0 16px 2px rgba(0, 229, 255, 0.3)',
        fontFamily: 'monospace',
        fontSize: 14,
        letterSpacing: 1.5,
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
      {lang === 'en' ? 'Back' : 'Retour'}
    </button>
  );
}
