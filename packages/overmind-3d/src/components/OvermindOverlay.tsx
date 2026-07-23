import { lazy, Suspense, useState, useEffect } from 'react';
import { OvermindProvider } from '../context/OvermindProvider.tsx';
import { useOvermind } from '../hooks/useOvermind.ts';
import { remapFrames, getTotalRawFrames } from '../machines/timelineMachine.ts';
import { ScrollGaugeOverlay } from './ScrollGaugeOverlay.tsx';
import { TransitionOverlay } from './TransitionOverlay.tsx';
import { SkipButton } from './SkipButton.tsx';
import { CardReadingScrollbar } from './CardReadingScrollbar.tsx';
import { ReadingBackButton } from './ReadingBackButton.tsx';

// Outils dev — chargés à la demande (lazy) : Vite les met dans des chunks séparés, jamais
// fetchés en prod (showDevPanel=false) → le visiteur ne télécharge pas l'atelier. En dev,
// comportement identique (chargement imperceptible). Même pattern que LazySceneRenderer.
const LazyDevControlPanel = lazy(() =>
  import('./devPanel/DevControlPanel.tsx').then((m) => ({ default: m.DevControlPanel }))
);
const LazyTimelinePanel = lazy(() =>
  import('./timeline/TimelinePanel.tsx').then((m) => ({ default: m.TimelinePanel }))
);
const LazyShortcutsOverlay = lazy(() =>
  import('./ShortcutsOverlay.tsx').then((m) => ({ default: m.ShortcutsOverlay }))
);
const LazyPipOverlay = lazy(() =>
  import('./PipOverlay.tsx').then((m) => ({ default: m.PipOverlay }))
);
const LazySentinelAnimPanel = lazy(() =>
  import('./SentinelAnimPanel.tsx').then((m) => ({ default: m.SentinelAnimPanel }))
);

function PipOverlayBridge() {
  const { sceneActor } = useOvermind();
  if (!sceneActor) return null;
  return <LazyPipOverlay sceneActor={sceneActor} />;
}

/** Écran « tourne ton appareil » — tactile + portrait seulement. iOS Safari ne supporte pas
 *  l'orientation lock : on ne peut qu'inciter (overlay au-dessus de tout, la scène continue
 *  de tourner derrière). Texte FR/EN sur le pattern du toast linkSystem (document lang). */
function OrientationGate() {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse || !portrait) return null;

  const fr = typeof document !== 'undefined' && document.documentElement.lang !== 'en';
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '18px', background: 'rgba(4, 10, 16, 0.96)', color: '#fff',
        fontFamily: 'monospace', textAlign: 'center', padding: '0 24px',
      }}
    >
      <div style={{ fontSize: '56px', animation: 'overmind-rotate-hint 2.4s ease-in-out infinite' }}>⟳</div>
      <div style={{ fontSize: '17px', letterSpacing: '1.5px', color: 'rgba(0, 229, 255, 0.9)' }}>
        {fr ? 'Tournez votre appareil' : 'Rotate your device'}
      </div>
      <div style={{ fontSize: '13px', opacity: 0.65, maxWidth: '260px', lineHeight: 1.5 }}>
        {fr
          ? "L'expérience 3D est conçue pour le mode paysage."
          : 'The 3D experience is designed for landscape mode.'}
      </div>
      <style>{`@keyframes overmind-rotate-hint { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } }`}</style>
    </div>
  );
}

/** Bridge : écoute les custom events window et les transmet au bloomActor */
function BloomColorBridge() {
  const { bloomActor } = useOvermind();

  useEffect(() => {
    if (!bloomActor) return;

    // Appliquer la couleur sauvegardée au démarrage
    const saved = localStorage.getItem('portfolio-bloom-color');
    if (saved) {
      bloomActor.send({ type: 'SET_BLOOM_COLOR', color: saved });
    }

    const handler = (e: Event) => {
      const color = (e as CustomEvent<string>).detail;
      bloomActor.send({ type: 'SET_BLOOM_COLOR', color });
    };
    window.addEventListener('overmind:set-bloom-color', handler);
    return () => window.removeEventListener('overmind:set-bloom-color', handler);
  }, [bloomActor]);

  return null;
}

/** Bridge : écoute le scroll ratio brut et le convertit en frame pour le timelineActor */
function ScrollBridge() {
  const { timelineActor } = useOvermind();

  useEffect(() => {
    if (!timelineActor) return;
    const handler = (e: Event) => {
      const rawRatio = (e as CustomEvent<number>).detail;
      const ctx = timelineActor.getSnapshot().context;
      const rawTotal = getTotalRawFrames(ctx.totalFrames, ctx.dwells);
      const rawFrame = rawRatio * rawTotal;
      const frame = remapFrames(rawFrame, ctx.dwells);
      timelineActor.send({ type: 'UPDATE_FRAME', frame });
    };
    window.addEventListener('overmind:scroll-progress', handler);
    return () => window.removeEventListener('overmind:scroll-progress', handler);
  }, [timelineActor]);

  return null;
}

const LazySceneRenderer = lazy(() =>
  import('../scene/SceneRenderer.tsx').then((m) => ({ default: m.SceneRenderer }))
);

export interface OvermindOverlayProps {
  basePath?: string;
  showDevPanel?: boolean;
}

export function OvermindOverlay({ basePath = '/', showDevPanel = false }: OvermindOverlayProps) {
  // « Mobile » = appareil TACTILE (pointeur grossier), PAS petit écran : un iPhone en paysage
  // dépasse 768px de large → un critère largeur ferait réapparaître les panneaux dev (retour
  // Paul : ils mangent l'écran sur tél). pointer:coarse reste vrai quelle que soit l'orientation.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );
  const [freeCamera, setFreeCamera] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Listen for camera mode toggle
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent<'free' | 'scroll'>).detail;
      const isFree = mode === 'free';
      setFreeCamera(isFree);
      // (le scroll natif de page est neutralisé en permanence via global.css depuis le
      //  portage mobile — plus besoin de basculer body.overflow au changement de caméra)
    };
    window.addEventListener('overmind:camera-mode', handler);
    return () => {
      window.removeEventListener('overmind:camera-mode', handler);
    };
  }, []);

  return (
    <OvermindProvider>
      <BloomColorBridge />
      <ScrollBridge />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: freeCamera ? 50 : -1,
          pointerEvents: freeCamera ? 'auto' : 'none',
        }}
      >
        <Suspense fallback={null}>
          {/* Voie B : renderer COMPLET partout — mobile compris (l'allègement viendra du
              qualityProfile, pas d'un renderer séparé). isMobile reste pour l'UX adaptative. */}
          <LazySceneRenderer basePath={basePath} />
        </Suspense>
      </div>
      {showDevPanel && !isMobile && (
        <Suspense fallback={null}>
          <LazyDevControlPanel />
          <LazyTimelinePanel />
          <LazyShortcutsOverlay />
          <PipOverlayBridge />
          <LazySentinelAnimPanel />
        </Suspense>
      )}
      <ScrollGaugeOverlay />
      <TransitionOverlay />
      <OrientationGate />
      <SkipButton />
      <CardReadingScrollbar />
      <ReadingBackButton />
    </OvermindProvider>
  );
}
