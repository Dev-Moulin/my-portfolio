import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Pont React i18n → scène 3D. Le package overmind-3d ne dépend pas de react-i18next ; on
 * diffuse donc la langue courante via un CustomEvent `window` à chaque changement (et au
 * montage initial). SceneRenderer l'écoute pour régénérer les textures des cartes holo (FR/EN).
 */
export default function LanguageBridge() {
  const { i18n } = useTranslation();
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('overmind:language-change', { detail: i18n.language })
    );
  }, [i18n.language]);
  return null;
}
