import { lazy, Suspense, useState, useEffect } from 'react';
import { OvermindProvider } from '../context/OvermindProvider.tsx';
import { useOvermind } from '../hooks/useOvermind.ts';
import { remapFrames, getTotalRawFrames } from '../machines/timelineMachine.ts';
import { DevControlPanel } from './devPanel/DevControlPanel.tsx';
import { TimelinePanel } from './timeline/TimelinePanel.tsx';
import { ShortcutsOverlay } from './ShortcutsOverlay.tsx';
import { PipOverlay } from './PipOverlay.tsx';
import { ScrollGaugeOverlay } from './ScrollGaugeOverlay.tsx';
import { CardReadingScrollbar } from './CardReadingScrollbar.tsx';

function PipOverlayBridge() {
  const { sceneActor } = useOvermind();
  if (!sceneActor) return null;
  return <PipOverlay sceneActor={sceneActor} />;
}

const MOBILE_BREAKPOINT = 768;

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

const LazyMobileSceneRenderer = lazy(() =>
  import('../scene/MobileSceneRenderer.tsx').then((m) => ({ default: m.MobileSceneRenderer }))
);

export interface OvermindOverlayProps {
  basePath?: string;
  showDevPanel?: boolean;
}

export function OvermindOverlay({ basePath = '/', showDevPanel = false }: OvermindOverlayProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  );
  const [freeCamera, setFreeCamera] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
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
      // Block/unblock page scroll
      document.body.style.overflow = isFree ? 'hidden' : '';
    };
    window.addEventListener('overmind:camera-mode', handler);
    return () => {
      window.removeEventListener('overmind:camera-mode', handler);
      document.body.style.overflow = '';
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
          {isMobile ? (
            <LazyMobileSceneRenderer basePath={basePath} />
          ) : (
            <LazySceneRenderer basePath={basePath} />
          )}
        </Suspense>
      </div>
      {showDevPanel && !isMobile && <DevControlPanel />}
      {showDevPanel && !isMobile && <TimelinePanel />}
      {showDevPanel && !isMobile && <ShortcutsOverlay />}
      {showDevPanel && !isMobile && <PipOverlayBridge />}
      <ScrollGaugeOverlay />
      <CardReadingScrollbar />
    </OvermindProvider>
  );
}
