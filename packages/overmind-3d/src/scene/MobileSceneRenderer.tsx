import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useOvermind } from '../hooks/useOvermind.ts';
import { createScene } from './sceneSetup.ts';
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
    bloomActor, lightsActor, sceneActor, timelineActor, isRunning,
  } = useOvermind();

  useEffect(() => {
    if (!containerRef.current || !isRunning) return;
    const container = containerRef.current;

    // 1. Scene setup (same as desktop)
    const setup = createScene(container);
    const { scene, camera, renderer, composer, bloomPass } = setup;

    // Mobile: create simple lights directly (no componentRegistry needed)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0x00ffff, 2.0, 100);
    pointLight.position.set(0, 2, 0);
    scene.add(pointLight);

    // 2. Connect machines (minimal — no model/pbr/material/steering)
    bloomActor?.send({ type: 'SET_BLOOM_PASS', bloomPass });
    sceneActor?.send({ type: 'SET_SCENE', scene });
    sceneActor?.send({ type: 'SET_CAMERA', camera });

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

    // 5. Minimal animation loop (bloom render only)
    const clock = new THREE.Clock();
    let animationId: number;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.033);

      scrollText?.update(delta);
      camKeyframes?.update(delta);
      composer.render();
    }

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      scrollText?.dispose();
      timelineSub?.unsubscribe();
      composer.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRunning, basePath, bloomActor, lightsActor, sceneActor, timelineActor]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
