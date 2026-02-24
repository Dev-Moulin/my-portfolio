import { lazy, Suspense, useState, useEffect } from 'react';
import { OvermindProvider } from '../context/OvermindProvider.tsx';
import { useOvermind } from '../hooks/useOvermind.ts';
import { DevControlPanel } from './DevControlPanel.tsx';
import { ScrollCard } from './ScrollCard.tsx';

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

/** Bridge : écoute le scroll progress et le transmet aux actors scroll-driven */
function ScrollBridge() {
  const { scrollTextActor, cameraKeyframeActor, scrollCardActor } = useOvermind();

  useEffect(() => {
    if (!scrollTextActor && !cameraKeyframeActor && !scrollCardActor) return;
    const handler = (e: Event) => {
      const progress = (e as CustomEvent<number>).detail;
      scrollTextActor?.send({ type: 'UPDATE_SCROLL', progress });
      cameraKeyframeActor?.send({ type: 'UPDATE_SCROLL', progress });
      scrollCardActor?.send({ type: 'UPDATE_SCROLL', progress });
    };
    window.addEventListener('overmind:scroll-progress', handler);
    return () => window.removeEventListener('overmind:scroll-progress', handler);
  }, [scrollTextActor, cameraKeyframeActor, scrollCardActor]);

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

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <OvermindProvider>
      <BloomColorBridge />
      <ScrollBridge />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
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
      {!isMobile && <ScrollCard />}
      {showDevPanel && !isMobile && <DevControlPanel />}
    </OvermindProvider>
  );
}
