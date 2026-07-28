import { useEffect, useState } from 'react';
import { AccentColorProvider } from './components/ThemeProvider';
import { OvermindOverlay, SentinelTrainScene, StarfieldDevPanel } from '@portfolio/overmind-3d';
import Layout from './components/Layout/Layout';
import LanguageBridge from './components/LanguageBridge';
import OnboardingBubble from './components/OnboardingBubble';
import CardGuidePopup from './components/CardGuidePopup';
import ScreenEdgeHint from './components/ScreenEdgeHint';

/**
 * Hash-based router: lets us isolate test scenes (e.g. `#sentinel-train`) without
 * pulling in react-router. Listens for `hashchange` to react to manual nav.
 */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function App() {
  const hash = useHashRoute();

  // Standalone test scenes — full-screen, bypass the portfolio entirely.
  if (hash === '#sentinel-train') {
    return <SentinelTrainScene basePath={import.meta.env.BASE_URL} />;
  }

  // Site 3D : plus de pages DOM ni d'émetteur de scroll DOM. La caméra est pilotée par la
  // gauge (molette) + la NavArc ; la navigation a une source de vérité unique (ScrollCameraAnimator).
  return (
    <AccentColorProvider>
      <div className="relative min-h-screen">
        <LanguageBridge />
        <OvermindOverlay basePath={import.meta.env.BASE_URL} showDevPanel={import.meta.env.DEV} />
        <Layout />
        <OnboardingBubble />
        <CardGuidePopup />
        <ScreenEdgeHint />
        {import.meta.env.DEV && <StarfieldDevPanel />}
      </div>
    </AccentColorProvider>
  );
}

export default App;
