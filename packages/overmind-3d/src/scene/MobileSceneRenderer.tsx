import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useOvermind } from '../hooks/useOvermind.ts';
import { createScene } from './sceneSetup.ts';
import { NeonBandsSystem } from './neonBands.ts';
import { ScrollTextSystem } from './scrollText.ts';
import { CameraKeyframeSystem } from './cameraKeyframes.ts';
import { getFontPath } from '../utils/dracoPath.ts';
import type { TimelineContext } from '../machines/timelineMachine.ts';

export interface MobileSceneRendererProps {
  basePath: string;
}

export function MobileSceneRenderer({ basePath }: MobileSceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    bloomActor, lightingActor, sceneActor, neonBandsActor, timelineActor, isRunning,
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
      neonBands = new NeonBandsSystem(scene, ctx);
      neonSub = neonBandsActor.subscribe((snapshot: { context: import('../machines/neonBandsMachine.ts').NeonBandsContext }) => {
        const c = snapshot.context;
        neonBands?.syncFromState(c);
      });
    }

    // 3b. Scroll text + Camera keyframes (from unified timelineActor)
    let scrollText: ScrollTextSystem | null = null;
    let camKeyframes: CameraKeyframeSystem | null = null;
    let timelineSub: { unsubscribe: () => void } | undefined;

    function buildScrollTextBridge(ctx: TimelineContext) {
      return {
        scrollProgress: ctx.currentFrame,
        titleText: ctx.titleText,
        titleFontSize: ctx.titleFontSize,
        titleColor: ctx.titleColor,
        titleEmissiveIntensity: ctx.titleEmissiveIntensity,
        subtitleText: ctx.subtitleText,
        subtitleFontSize: ctx.subtitleFontSize,
        subtitleColor: ctx.subtitleColor,
        subtitleEmissiveIntensity: ctx.subtitleEmissiveIntensity,
        titleLayout: ctx.titleLayout,
        subtitleLayout: ctx.subtitleLayout,
        visible: ctx.textVisible,
      };
    }

    if (timelineActor) {
      const ctx = timelineActor.getSnapshot().context;

      scrollText = new ScrollTextSystem(
        scene,
        camera,
        getFontPath(basePath, 'Cynatar.otf'),
        getFontPath(basePath, 'SF-TransRobotics.ttf'),
        buildScrollTextBridge(ctx),
      );

      camKeyframes = new CameraKeyframeSystem(camera, {
        keyframes: ctx.cameraKeyframes,
        scrollProgress: ctx.currentFrame,
        enabled: ctx.cameraEnabled,
      });

      timelineSub = timelineActor.subscribe((snapshot) => {
        const c = snapshot.context;
        scrollText?.syncFromState(buildScrollTextBridge(c));
        camKeyframes?.syncFromState({
          keyframes: c.cameraKeyframes,
          scrollProgress: c.currentFrame,
          enabled: c.cameraEnabled,
        });
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
      scrollText?.update(delta);
      camKeyframes?.update(delta);
      composer.render();
    }

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      neonBands?.dispose();
      neonSub?.unsubscribe();
      scrollText?.dispose();
      timelineSub?.unsubscribe();
      composer.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRunning, basePath, bloomActor, lightingActor, sceneActor, neonBandsActor, timelineActor]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
