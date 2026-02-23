import { lazy, Suspense, useState, useEffect } from 'react';
import { OvermindProvider } from '../context/OvermindProvider.tsx';
import { DevControlPanel } from './DevControlPanel.tsx';

const MOBILE_BREAKPOINT = 768;

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
      {showDevPanel && !isMobile && <DevControlPanel />}
    </OvermindProvider>
  );
}
