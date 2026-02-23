import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as YUKA from 'yuka';
import { useOvermind } from '../hooks/useOvermind.ts';
import { WanderBehaviorXY } from '../systems/WanderBehaviorXY.ts';
import { SoftBoundaryBehavior } from '../systems/SoftBoundaryBehavior.ts';
import { MouseRepulsionBehavior } from '../systems/MouseRepulsionBehavior.ts';
import type { ModelSettings } from './types.ts';
import { createScene } from './sceneSetup.ts';
import { loadModel } from './modelLoader.ts';
import { InputTracker } from './inputTracker.ts';
import { GazeSystem } from './gazeSystem.ts';
import { NeonBandsSystem } from './neonBands.ts';

const MOUSE_SENSITIVITY = 0.05;
const MOUSE_RETURN_SPEED = 0.04;

export interface SceneRendererProps {
  basePath: string;
}

export function SceneRenderer({ basePath }: SceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const {
    bloomActor, lightingActor, materialActor, modelActor, pbrActor,
    sceneActor, performanceActor, revelationActor, neonBandsActor,
    steeringActor, isRunning,
  } = useOvermind();

  const modelSettingsRef = useRef<ModelSettings>({
    positionX: 0, positionY: 1.0, positionZ: 0,
    scale: 1, baseRotationY: 0,
    mouseSensitivity: MOUSE_SENSITIVITY, mouseReturnSpeed: MOUSE_RETURN_SPEED,
    mouseDeadZone: 0.1, mouseMaxRotY: Math.PI / 3,
    mouseMaxRotX: Math.PI / 6, mouseInactiveMs: 3000,
  });

  // Subscribe to model machine for settings updates
  useEffect(() => {
    if (!modelActor) return;
    const subscription = modelActor.subscribe((state) => {
      modelSettingsRef.current = { ...state.context };
    });
    return () => subscription.unsubscribe();
  }, [modelActor]);

  // Main setup + animation loop
  useEffect(() => {
    if (!containerRef.current || !isRunning) return;
    const container = containerRef.current;

    // 1. Scene setup
    const setup = createScene(container);
    const { scene, camera, renderer, composer, bloomPass, ambientLight, directionalLight, pointLight } = setup;

    // 2. Connect machines
    bloomActor?.send({ type: 'SET_BLOOM_PASS', bloomPass });
    lightingActor?.send({ type: 'SET_RENDERER', renderer });
    lightingActor?.send({ type: 'SET_LIGHTS', ambientLight, directionalLight, pointLight });
    pbrActor?.send({ type: 'SET_RENDERER', renderer });
    sceneActor?.send({ type: 'SET_SCENE', scene });
    sceneActor?.send({ type: 'SET_CAMERA', camera });

    // 3. Initialize scene helpers (grid + axes) for sceneMachine
    const gridHelper = new THREE.GridHelper(10, 10, new THREE.Color('#888888'), new THREE.Color('#444444'));
    gridHelper.visible = false;
    scene.add(gridHelper);
    sceneActor?.send({ type: 'INITIALIZE_GRID', gridHelper });

    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.visible = false;
    scene.add(axesHelper);
    sceneActor?.send({ type: 'INITIALIZE_AXES', axesHelper });

    // 3b. Neon bands backdrop
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

    // 4. Load model
    const modelDispose = loadModel(scene, basePath, (result, materials, reveal) => {
      modelRef.current = result.model;
      mixerRef.current = result.mixer;

      // Connect material + pbr machines
      if (materials.iris.length > 0) {
        materialActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'iris', materials: materials.iris });
        pbrActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'iris', materials: materials.iris });
      }
      if (materials.eyeRings.length > 0) {
        materialActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'eyeRings', materials: materials.eyeRings });
        pbrActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'eyeRings', materials: materials.eyeRings });
      }
      if (materials.revealRings.length > 0) {
        materialActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'revealRings', materials: materials.revealRings });
      }

      // Connect revelation machine
      if (revelationActor && reveal.objects.length > 0) {
        materialActor?.send({ type: 'SET_REVEAL_OBJECTS', objects: reveal.objects });
        revelationActor.send({ type: 'SET_RINGS', rings: reveal.objects });
        revelationActor.send({ type: 'SET_MODEL_REFERENCE', model: reveal.model });
      }
    });

    // 5. Resize handler
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

    // 6. Input tracking
    const input = new InputTracker();
    const detachInput = input.attach();

    // 7. Yuka setup — read initial steering values from machine
    const st0 = steeringActor?.getSnapshot().context;
    const yukaEntityManager = new YUKA.EntityManager();
    const yukaVehicle = new YUKA.Vehicle();
    const ms0 = modelSettingsRef.current;
    yukaVehicle.position.set(ms0.positionX, ms0.positionY, ms0.positionZ);
    yukaVehicle.maxSpeed = st0?.maxSpeed ?? 1.7;
    yukaVehicle.maxForce = st0?.maxForce ?? 3.0;
    yukaVehicle.mass = st0?.mass ?? 5.0;

    const zBack0 = st0?.boundaryZBack ?? 5.0;
    const zFront0 = st0?.boundaryZFront ?? 1.5;
    const hasZ0 = (zBack0 + zFront0) > 0;
    const wanderBehavior = new WanderBehaviorXY(
      st0?.wanderRadius ?? 1.5,
      st0?.wanderDistance ?? 2.0,
      st0?.wanderJitter ?? 1.5,
      hasZ0 ? (st0?.wanderZFactor ?? 0.6) : 0,
    );
    wanderBehavior.active = true;

    const xRange = st0?.boundaryXRange ?? 8;
    const yDown = st0?.boundaryYDown ?? 3;
    const yUp = st0?.boundaryYUp ?? 4;
    const boundaryBehavior = new SoftBoundaryBehavior(
      {
        xMin: ms0.positionX - xRange, xMax: ms0.positionX + xRange,
        yMin: ms0.positionY - yDown, yMax: ms0.positionY + yUp,
        zMin: hasZ0 ? ms0.positionZ - zBack0 : undefined,
        zMax: hasZ0 ? ms0.positionZ + zFront0 : undefined,
      },
      st0?.boundaryMargin ?? 2.5,
      st0?.boundaryStrength ?? 2.0,
    );
    boundaryBehavior.weight = st0?.boundaryWeight ?? 3.0;
    boundaryBehavior.active = true;

    const mouseRepulsion = new MouseRepulsionBehavior(
      st0?.repulsionBaseMinDist ?? 3.0,
      st0?.repulsionAmplitude ?? 1.5,
      st0?.repulsionSpeed ?? 0.3,
      st0?.repulsionStrength ?? 4.0,
    );
    mouseRepulsion.weight = st0?.repulsionWeight ?? 3.0;
    mouseRepulsion.active = true;

    // Keep a mutable ref for wall bounce factor
    let wallBounceFactor = st0?.wallBounceFactor ?? 0.05;

    yukaVehicle.steering.add(wanderBehavior);
    yukaVehicle.steering.add(boundaryBehavior);
    yukaVehicle.steering.add(mouseRepulsion);
    yukaEntityManager.add(yukaVehicle);

    // 7b. Subscribe to steeringActor for live updates
    const steeringSub = steeringActor?.subscribe((snapshot: { context: import('../machines/steeringMachine.ts').SteeringContext }) => {
      const c = snapshot.context;
      // Vehicle
      yukaVehicle.maxSpeed = c.maxSpeed;
      yukaVehicle.maxForce = c.maxForce;
      yukaVehicle.mass = c.mass;
      // Wander
      wanderBehavior.radius = c.wanderRadius;
      wanderBehavior.distance = c.wanderDistance;
      wanderBehavior.jitter = c.wanderJitter;
      // Boundaries
      const mPos = modelSettingsRef.current;
      boundaryBehavior.setBounds({
        xMin: mPos.positionX - c.boundaryXRange,
        xMax: mPos.positionX + c.boundaryXRange,
        yMin: mPos.positionY - c.boundaryYDown,
        yMax: mPos.positionY + c.boundaryYUp,
        zMin: (c.boundaryZBack + c.boundaryZFront) > 0 ? mPos.positionZ - c.boundaryZBack : undefined,
        zMax: (c.boundaryZBack + c.boundaryZFront) > 0 ? mPos.positionZ + c.boundaryZFront : undefined,
      });
      boundaryBehavior.margin = c.boundaryMargin;
      boundaryBehavior.strength = c.boundaryStrength;
      boundaryBehavior.weight = c.boundaryWeight;
      // Wander Z factor
      wanderBehavior.zFactor = (c.boundaryZBack + c.boundaryZFront) > 0 ? c.wanderZFactor : 0;
      // Mouse repulsion
      mouseRepulsion.baseMinDistance = c.repulsionBaseMinDist;
      mouseRepulsion.variationAmplitude = c.repulsionAmplitude;
      mouseRepulsion.variationSpeed = c.repulsionSpeed;
      mouseRepulsion.strength = c.repulsionStrength;
      mouseRepulsion.weight = c.repulsionWeight;
      // Wall bounce
      wallBounceFactor = c.wallBounceFactor;
    });

    // 8. Gaze system
    const gaze = new GazeSystem();

    // 9. Performance monitoring helpers
    let frameCount = 0;
    let fpsAccum = 0;
    const fpsInterval = 1.0; // report FPS every second

    // 10. Animation loop
    const clock = new THREE.Clock();
    let animationId: number;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.033);

      // Update mouse world position for repulsion (map NDC to camera frustum, not boundary)
      const vFov = camera.fov * Math.PI / 180;
      const frustumHalfH = Math.tan(vFov / 2) * camera.position.z;
      const frustumHalfW = frustumHalfH * camera.aspect;
      mouseRepulsion.setMousePosition(
        input.mouseNDC.x * frustumHalfW,
        input.mouseNDC.y * frustumHalfH,
      );

      // Yuka steering update
      yukaEntityManager.update(delta);

      // Post-Yuka safety: soft bounce at boundaries
      const b = boundaryBehavior.bounds;
      const vp = yukaVehicle.position;
      const vel = yukaVehicle.velocity;

      if (vp.x < b.xMin) { vp.x = b.xMin; vel.x = Math.abs(vel.x) * wallBounceFactor; }
      else if (vp.x > b.xMax) { vp.x = b.xMax; vel.x = -Math.abs(vel.x) * wallBounceFactor; }
      if (vp.y < b.yMin) { vp.y = b.yMin; vel.y = Math.abs(vel.y) * wallBounceFactor; }
      else if (vp.y > b.yMax) { vp.y = b.yMax; vel.y = -Math.abs(vel.y) * wallBounceFactor; }

      // Z axis: clamp if Z bounds are defined, otherwise lock to initial Z
      if (b.zMin !== undefined && b.zMax !== undefined) {
        if (vp.z < b.zMin) { vp.z = b.zMin; vel.z = Math.abs(vel.z) * wallBounceFactor; }
        else if (vp.z > b.zMax) { vp.z = b.zMax; vel.z = -Math.abs(vel.z) * wallBounceFactor; }
      } else {
        vel.z = 0;
        vp.z = ms0.positionZ;
      }

      // Input tracking
      const ms = modelSettingsRef.current;
      const lerpFactor = input.isActive ? ms.mouseSensitivity : ms.mouseReturnSpeed;
      input.update(delta, lerpFactor);

      // Gaze system (blend mouse <-> autonomous)
      gaze.update(delta, input.lastMoveTimestamp, yukaVehicle, true);

      // Apply to model
      if (modelRef.current) {
        modelRef.current.position.set(vp.x, vp.y, vp.z);
        modelRef.current.scale.setScalar(ms.scale);

        const finalRotY = THREE.MathUtils.lerp(input.currentRotY, gaze.autonomousRotY, gaze.blendFactor);
        const finalRotX = THREE.MathUtils.lerp(input.currentRotX, gaze.autonomousRotX, gaze.blendFactor);
        modelRef.current.rotation.y = ms.baseRotationY + finalRotY;
        modelRef.current.rotation.x = finalRotX;
      }

      // Revelation zone-based visibility
      revelationActor?.send({ type: 'UPDATE_REVELATION' });

      // Neon bands cascade animation
      neonBands?.update(delta);

      // Animations
      mixerRef.current?.update(delta);

      // Performance monitoring
      frameCount++;
      fpsAccum += delta;
      if (fpsAccum >= fpsInterval) {
        const currentFps = frameCount / fpsAccum;
        performanceActor?.send({ type: 'UPDATE_FPS', fps: currentFps });
        frameCount = 0;
        fpsAccum = 0;

        // Memory
        const perfMemory = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        if (perfMemory) {
          performanceActor?.send({
            type: 'UPDATE_MEMORY',
            used: perfMemory.usedJSHeapSize / (1024 * 1024),
            limit: perfMemory.jsHeapSizeLimit / (1024 * 1024),
          });
        }

        // Renderer info
        const info = renderer.info;
        performanceActor?.send({
          type: 'UPDATE_RENDERER_INFO',
          info: {
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length ?? 0,
            calls: info.render.calls,
          },
        });
      }

      // Render with bloom
      composer.render();
    }

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      detachInput();
      steeringSub?.unsubscribe();
      gaze.dispose();
      neonBands?.dispose();
      neonSub?.unsubscribe();
      modelDispose.dispose();
      yukaEntityManager.clear();
      composer.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      modelRef.current = null;
      mixerRef.current = null;
    };
  }, [isRunning, basePath, bloomActor, lightingActor, materialActor, pbrActor, modelActor, sceneActor, performanceActor, revelationActor, neonBandsActor, steeringActor]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
