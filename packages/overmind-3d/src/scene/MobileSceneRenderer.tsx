import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useOvermind } from '../hooks/useOvermind.ts';
import { createScene } from './sceneSetup.ts';
import { NeonBandsSystem } from './neonBands.ts';

export interface MobileSceneRendererProps {
  basePath: string;
}

export function MobileSceneRenderer({ basePath: _basePath }: MobileSceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    bloomActor, lightingActor, sceneActor, neonBandsActor, isRunning,
  } = useOvermind();

  useEffect(() => {
    if (!containerRef.current || !isRunning) return;
    const container = containerRef.current;

    // 1. Scene setup (same as desktop)
    const setup = createScene(container);
    const { scene, camera, renderer, composer, bloomPass, ambientLight, directionalLight, pointLight } = setup;

    // 2. Connect machines (minimal — no model/pbr/material/steering)
    bloomActor?.send({ type: 'SET_BLOOM_PASS', bloomPass });
    lightingActor?.send({ type: 'SET_RENDERER', renderer });
    lightingActor?.send({ type: 'SET_LIGHTS', ambientLight, directionalLight, pointLight });
    sceneActor?.send({ type: 'SET_SCENE', scene });
    sceneActor?.send({ type: 'SET_CAMERA', camera });

    // 3. Neon bands only (no model, no Yuka)
    let neonBands: NeonBandsSystem | null = null;
    let neonSub: { unsubscribe: () => void } | undefined;
    if (neonBandsActor) {
      const neonState = neonBandsActor.getSnapshot();
      const ctx = neonState.context;
      neonBands = new NeonBandsSystem(scene, ctx.bands, ctx.bandSpacing, ctx.positionX, ctx.positionY, ctx.positionZ, ctx.scale, ctx.arcRadius, ctx.depthSpread, ctx.lineLength);
      neonBands.syncFromState(ctx.bands, ctx.bandSpacing, ctx.flowEnabled, ctx.flowSpeed, ctx.globalIntensity, ctx.positionX, ctx.positionY, ctx.positionZ, ctx.scale, ctx.arcRadius, ctx.depthSpread, ctx.lineLength);
      neonSub = neonBandsActor.subscribe((snapshot: { context: import('../machines/neonBandsMachine.ts').NeonBandsContext }) => {
        const c = snapshot.context;
        neonBands?.syncFromState(c.bands, c.bandSpacing, c.flowEnabled, c.flowSpeed, c.globalIntensity, c.positionX, c.positionY, c.positionZ, c.scale, c.arcRadius, c.depthSpread, c.lineLength);
      });
    }

    // 4. Resize handler
    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer.setSize(w, h);
      const dpr = Math.min(window.devicePixelRatio, 2);
      const bloomScale = dpr > 1 ? 0.5 : 1.0;
      bloomPass.resolution.set(w * bloomScale, h * bloomScale);
    }
    window.addEventListener('resize', onResize);

    // 5. Minimal animation loop (neon + bloom render only)
    const clock = new THREE.Clock();
    let animationId: number;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.033);

      neonBands?.update(delta);
      composer.render();
    }

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      neonBands?.dispose();
      neonSub?.unsubscribe();
      composer.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRunning, bloomActor, lightingActor, sceneActor, neonBandsActor]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
