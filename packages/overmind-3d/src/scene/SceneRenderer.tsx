import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { useOvermind } from '../hooks/useOvermind.ts';
import type { ModelSettings } from './types.ts';
import { createScene } from './sceneSetup.ts';
import { loadModel, loadSecondaryModel } from './modelLoader.ts';
import { applyHoloScreensToCards } from './holoScreenShader.ts';
import { applyHoloWalls } from './holoWallShader.ts';
import { MiniShipParticleSystem } from './miniShipParticles.ts';
import { applySunShader } from './sunShader.ts';
import { ScrollCameraAnimator } from './scrollCameraAnimator.ts';
import { CardClickSystem } from './cardClickSystem.ts';
import { CardNoiseSystem } from './cardNoiseSystem.ts';
import { InputTracker } from './inputTracker.ts';
import { GazeSystem } from './gazeSystem.ts';
import { SelectionSystem } from './selectionSystem.ts';
import { CardSystem } from './cardSystem.ts';
import { ComponentRegistry, asAnyDescriptor } from './componentRegistry.ts';
import { textDescriptor, lightDescriptor, cardDescriptor } from './descriptors/index.ts';
import { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import { ScrollCardContent3D } from '../components/ScrollCard.tsx';
import type { SceneActors, SceneMutableState } from './sceneContext.ts';
import { setupYuka } from './yukaSetup.ts';
import { setupTimelineBridge } from './timelineBridge.ts';
import { setupCameraHelpers } from './cameraHelpers.ts';
import { InfiniteGrid } from './infiniteGrid.ts';
import { ViewCubeWrapper } from './viewCube.ts';
import { setupKeyboardHandlers } from './keyboardHandler.ts';
import { setupGizmoBridge } from './gizmoBridge.ts';
import { setupConfigBridge } from './configBridge.ts';
import { startAnimationLoop } from './animationLoop.ts';
import { PIPViewport } from './pipViewport.ts';
import { LightHelperSystem } from './lightHelperSystem.ts';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Install camera-controls with THREE subsets
CameraControls.install({ THREE });

const MOUSE_SENSITIVITY = 0.05;
const MOUSE_RETURN_SPEED = 0.04;

export interface SceneRendererProps {
  basePath: string;
}

export function SceneRenderer({ basePath }: SceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const secondaryModelRef = useRef<THREE.Object3D | null>(null);
  const [cardPortals, setCardPortals] = useState<Map<string, HTMLDivElement>>(new Map());

  const {
    bloomActor, lightsActor, materialActor, modelActor, pbrActor,
    sceneActor, performanceActor, revelationActor,
    steeringActor, timelineActor, selectionActor, interactionModeActor, isRunning,
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

    // ── 1. Scene setup ────────────────────────────────────────────────────

    const setup = createScene(container);
    const { scene, camera, renderer, cssRenderer, composer, bloomPass, outlinePass, ambientLight } = setup;

    // Init RectAreaLight uniforms (must be called before any RectAreaLight is created)
    RectAreaLightUniformsLib.init();

    // ── 2. Selection + Card systems ───────────────────────────────────────

    const selection = new SelectionSystem(camera, renderer.domElement, outlinePass, scene);

    // Rotation HUD overlay
    const rotHud = document.createElement('div');
    Object.assign(rotHud.style, {
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.75)',
      color: '#fff',
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      padding: '4px 12px',
      borderRadius: '4px',
      pointerEvents: 'none',
      zIndex: '9999',
      display: 'none',
    });
    container.appendChild(rotHud);

    // dirLight/pointLight proxy meshes + registration are now handled by lightsMachine + lightDescriptor

    const cardSystem = new CardSystem(scene);
    selection.register('card', cardSystem.getProxyMesh());
    selectionActor?.send({ type: 'REGISTER_ID', id: 'card' });
    setCardPortals(new Map([['card', cardSystem.getPortalTarget()]]));

    // ── 3. Component registry + Undo/Redo ─────────────────────────────────

    const componentRegistry = new ComponentRegistry([
      asAnyDescriptor(textDescriptor),
      asAnyDescriptor(lightDescriptor),
      asAnyDescriptor(cardDescriptor),
    ]);

    const componentCtx = {
      scene,
      registerSelectable: (id: string, obj: THREE.Object3D) => selection.register(id, obj),
    };

    const undoManager = (bloomActor && lightsActor && materialActor && modelActor
      && sceneActor && steeringActor && timelineActor && selectionActor)
      ? new UndoRedoManager(
          {
            bloom: bloomActor, lights: lightsActor, material: materialActor,
            model: modelActor, scene: sceneActor,
            steering: steeringActor, timeline: timelineActor, selection: selectionActor,
          },
          componentRegistry, componentCtx, selection, scene,
        )
      : null;

    function broadcastUndoState() {
      if (!undoManager) return;
      window.dispatchEvent(new CustomEvent('overmind:undo-state', {
        detail: { canUndo: undoManager.canUndo(), canRedo: undoManager.canRedo() },
      }));
    }

    // ── 4. Connect machines ───────────────────────────────────────────────

    bloomActor?.send({ type: 'SET_BLOOM_PASS', bloomPass });
    lightsActor?.send({ type: 'INIT', renderer, ambientLight, registry: componentRegistry, ctx: componentCtx });
    lightsActor?.send({ type: 'CREATE_DEFAULT_LIGHTS' });
    pbrActor?.send({ type: 'SET_RENDERER', renderer });
    sceneActor?.send({ type: 'SET_SCENE', scene });
    sceneActor?.send({ type: 'SET_CAMERA', camera });

    // Scene helpers (grid + axes)
    const infiniteGrid = new InfiniteGrid();
    infiniteGrid.visible = false;
    scene.add(infiniteGrid);
    sceneActor?.send({ type: 'INITIALIZE_GRID', gridHelper: infiniteGrid });

    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.visible = false;
    scene.add(axesHelper);
    sceneActor?.send({ type: 'INITIALIZE_AXES', axesHelper });

    // ── 4b. Light helpers ────────────────────────────────────────────────

    const lightHelpers = new LightHelperSystem(scene);
    // dirLight/pointLight helpers are now attached via lightDescriptor events

    // Sync visibility from XState
    const lightHelpersSub = sceneActor?.subscribe((snap) => {
      lightHelpers.setVisible(snap.context.lightHelpersVisible);
    });

    // Listen for instance light helper attach/detach events
    const onLightHelperAttach = (e: Event) => {
      const { id, light } = (e as CustomEvent<{ id: string; light: THREE.Light }>).detail;
      lightHelpers.attach(id, light);
    };
    const onLightHelperDetach = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      lightHelpers.detach(id);
    };
    window.addEventListener('overmind:light-helper-attach', onLightHelperAttach);
    window.addEventListener('overmind:light-helper-detach', onLightHelperDetach);

    // ── 5. Actors bundle ──────────────────────────────────────────────────

    const actors: SceneActors = {
      bloomActor, lightsActor, materialActor, modelActor, pbrActor,
      sceneActor, performanceActor, revelationActor,
      steeringActor, timelineActor, selectionActor, interactionModeActor,
    };

    // ── 6. Shared mutable state ───────────────────────────────────────────

    const state: SceneMutableState = {
      freeCameraActive: false,
      cachedElementTransforms: {},
      cachedCardOpacity: 0,
      cachedInstanceOpacities: {},
      steeringRanges: { xRange: 8, yDown: 3, yUp: 4, zBack: 5, zFront: 1.5 },
      wallBounceFactor: 0.05,
      cachedEyePathPosition: null,
      cachedEyePathBlend: 0,
      cachedEyePathRepulsionScale: 1,
      cachedEyePathTangent: null,
      cachedFollowPathStates: {},
      pipVisible: false,
      pipSize: 'S',
      anneauxMesh: null,
      extDetailsMesh: null,
      intDetailsMesh: null,
      intDetails001Mesh: null,
      particleSystem: null,
      sunMat: null,
      holoCardMats: [],
      holoWallMats: [],
      cameraAnimator: null,
      cardClickSystem: null,
      cardNoise: null,
      trackToAssignments: {},
    };

    // ── 7. Yuka steering ──────────────────────────────────────────────────

    const ms0 = modelSettingsRef.current;
    const yuka = setupYuka(actors, ms0, state, modelSettingsRef);

    // ── 8. Timeline bridge (scrollText + camKF + visual bridge) ──────────

    const timeline = setupTimelineBridge(
      actors, scene, camera, selection, basePath, state,
    );

    // ── 9. Camera helpers ─────────────────────────────────────────────────

    const cam = setupCameraHelpers(
      camera, scene, renderer, selection,
      timeline.scrollText,
      cardSystem, componentRegistry, actors, state,
    );

    // Connect ghostCamera to CameraKeyframeSystem for frustum visualization
    timeline.camKeyframes?.setGhostCamera(cam.ghostCamera);

    // ── 9c. PIP viewport ──────────────────────────────────────────────────

    const pipViewport = new PIPViewport(scene);

    // Sync PIP state from XState → mutable cache
    const pipSub = sceneActor?.subscribe((snap) => {
      state.pipVisible = snap.context.pipVisible;
      state.pipSize = snap.context.pipSize;
    });

    // Wire PIP OrbitControls when overlay div mounts
    const onPipMount = (e: Event) => {
      const el = (e as CustomEvent<HTMLDivElement>).detail;
      pipViewport.attachControls(el);
    };
    const onPipUnmount = () => {
      // Controls will be disposed/replaced on next mount
    };
    window.addEventListener('overmind:pip-overlay-mount', onPipMount);
    window.addEventListener('overmind:pip-overlay-unmount', onPipUnmount);

    // ── 9b. ViewCube gizmo ────────────────────────────────────────────────

    const viewCube = new ViewCubeWrapper(camera, renderer, cam.cameraControls);
    viewCube.setVisible(false); // Only visible in free camera mode

    // Show/hide ViewCube when camera mode changes
    const onCameraMode = (e: Event) => {
      const mode = (e as CustomEvent<'free' | 'scroll'>).detail;
      viewCube.setVisible(mode === 'free');
    };
    window.addEventListener('overmind:camera-mode', onCameraMode);

    // ── 10. Keyboard handlers ─────────────────────────────────────────────

    const keyboardDisposable = setupKeyboardHandlers({
      actors, selection, componentRegistry, componentCtx, undoManager, cardSystem,
      cameraControls: cam.cameraControls,
      camera, state, basePath,
      yukaVehicle: yuka.vehicle, setCardPortals,
      toggleCameraMode: cam.toggleCameraMode,
      captureKeyframe: cam.captureKeyframe,
      insertInterpolatedKeyframe: cam.insertInterpolatedKeyframe,
      captureElementKeyframe: cam.captureElementKeyframe,
      broadcastUndoState,
      interactionModeActor,
    });

    // ── 11. Load model ────────────────────────────────────────────────────

    const modelDispose = loadModel(scene, basePath, (result, materials, reveal) => {
      modelRef.current = result.model;
      result.model.userData.selectableId = 'model';
      selection.register('model', result.model);
      selectionActor?.send({ type: 'REGISTER_ID', id: 'model' });
      mixerRef.current = result.mixer;

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

      if (revelationActor && reveal.objects.length > 0) {
        materialActor?.send({ type: 'SET_REVEAL_OBJECTS', objects: reveal.objects });
        revelationActor.send({ type: 'SET_RINGS', rings: reveal.objects });
        revelationActor.send({ type: 'SET_MODEL_REFERENCE', model: reveal.model });
      }
    });

    // ── 11b. Load secondary model (Eye_Realist) — DISABLED ──────────────
    const secondaryModelDispose = { dispose: () => {} };
    // const secondaryModelDispose = loadSecondaryModel(scene, basePath, 'Eye_Realist.glb', (model) => {
    //   secondaryModelRef.current = model;
    //   model.position.set(3, 0, 0);
    //   model.userData.selectableId = 'eye-realist';
    //   selection.register('eye-realist', model);
    //   selectionActor?.send({ type: 'REGISTER_ID', id: 'eye-realist' });
    // });

    // ── 11c. Holo screen refs (kept for animation loop) ─────────────────
    const holoScreenMats: THREE.ShaderMaterial[] = [];
    const holoScreenMatRef: { current: THREE.ShaderMaterial | null } = { current: null };
    const cardHoloDisposes: { dispose: () => void }[] = [];

    // ── 11d. Load Spaceship_V1_Assetify2 model ─────────────────────────────
    const spaceshipV1Dispose = loadSecondaryModel(scene, basePath, 'Spaceship_V2_ACTION.glb', (model, animations) => {
      model.position.set(20, 3, -5);
      model.scale.setScalar(1 / 4);  // scale down 2.5x
      model.userData.selectableId = 'spaceship-v1';
      selection.register('spaceship-v1', model);
      selectionActor?.send({ type: 'REGISTER_ID', id: 'spaceship-v1' });

      // Find Anneaux mesh + Spaceship_Base material for texture swap
      let baseMaterial: THREE.Material | THREE.Material[] | null = null;
      const SWAP_TARGETS = new Set([
        'Spaceship_Interior_Details004_gameasset',
        'Spaceship_Interior_Details003_gameasset',
        'Cube004_gameasset',
        'Plane_gameasset',
      ]);

      // First pass: find base material
      model.traverse((child) => {
        if (child.name === 'Spaceship_Base_gameasset' && (child as THREE.Mesh).isMesh) {
          baseMaterial = (child as THREE.Mesh).material;
        }
      });

      // Second pass: apply base material to targets + fix alpha + find Anneaux
      model.traverse((child) => {
        if (child.name === 'Anneaux_gameasset') state.anneauxMesh = child;
        if (child.name === 'Spaceship_Exterieur_Details_Alpha_gameasset') state.extDetailsMesh = child;
        if (child.name === 'Spaceship_Interior_Details_gameasset') state.intDetailsMesh = child;
        if (child.name === 'Spaceship_Interior_Details001_gameasset') state.intDetails001Mesh = child;
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;

        // Swap material for target meshes
        if (baseMaterial && SWAP_TARGETS.has(child.name)) {
          mesh.material = baseMaterial;
        }

        // Fix alpha sorting on all meshes
        const mats = Array.isArray(mesh.material) ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material];
        for (const mat of mats) {
          if (!mat) continue;
          const std = mat as THREE.MeshStandardMaterial;
          if (std.transparent) {
            std.transparent = false;
            std.alphaTest = 0.5;
            std.depthWrite = true;
          }
          mat.needsUpdate = true;
        }
      });

      // Init mini ship particle system
      state.particleSystem = new MiniShipParticleSystem(model, scene);

      // Apply sun shader to Sun mesh
      const sunMat = applySunShader(model);
      if (sunMat) {
        lightsActor?.send({ type: 'SET_SUN_MAT', mat: sunMat });
        state.sunMat = sunMat;
      }

      // Init scroll-driven camera animator (uses CameraAB/BC/CD + their NLA clips)
      // Created sync so the camera snaps to point A immediately, before holo cards finish loading
      const cameraAnimator = new ScrollCameraAnimator(camera, model, animations);
      state.cameraAnimator = cameraAnimator;

      // Init card noise (subtle XYZ position oscillation on Card1/2/3 meshes)
      state.cardNoise = new CardNoiseSystem(model);

      // Apply holographic shader to walls with scrolling logos (async, awaits SVG load)
      applyHoloWalls(model, basePath).then(walls => {
        state.holoWallMats = walls;
      });

      // Apply holographic shader to card screens (async — awaits fonts + profile image)
      applyHoloScreensToCards(model).then(holoCardEntries => {
        state.holoCardMats = holoCardEntries.map(e => e.material);
        cameraAnimator.setCardEntries(holoCardEntries);
        state.cardClickSystem = new CardClickSystem(camera, renderer, holoCardEntries, cameraAnimator);
      });
    });

    // Listener pour les boutons dev "Goto A/B/C/D"
    const onCameraJump = (e: Event) => {
      const point = (e as CustomEvent<'A' | 'B' | 'C' | 'D'>).detail;
      state.cameraAnimator?.jumpToPoint(point);
    };
    window.addEventListener('overmind:camera-jump', onCameraJump);

    // ── 12. Gizmo bridge ──────────────────────────────────────────────────

    const gizmoDisposable = setupGizmoBridge({
      actors, selection, componentRegistry, undoManager, cardSystem,
      eyePathSystem: timeline.eyePathSystem,
      cameraControls: cam.cameraControls, rotHud, state,
      captureElementKeyframe: cam.captureElementKeyframe,
      broadcastUndoState, setCardPortals,
    });

    // ── 13. Config bridge (DevPanel + save/load) ──────────────────────────

    const configDisposable = setupConfigBridge({
      actors, selection, componentRegistry, componentCtx, cardSystem, scene, setCardPortals,
      undoManager, camera, basePath, broadcastUndoState, state,
    });

    // ── 14. Input + Gaze ──────────────────────────────────────────────────

    const input = new InputTracker();
    const detachInput = input.attach();
    const gaze = new GazeSystem();

    // ── 15. Resize handler ────────────────────────────────────────────────

    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer.setSize(w, h);
      cssRenderer.setSize(w, h);
      const dpr = Math.min(window.devicePixelRatio, 2);
      const bloomScale = dpr > 1 ? 0.5 : 1.0;
      bloomPass.resolution.set(w * bloomScale, h * bloomScale);
    }
    window.addEventListener('resize', onResize);

    // ── 16. Animation loop ────────────────────────────────────────────────

    const loopDisposable = startAnimationLoop({
      camera, renderer, cssRenderer, composer, scene,
      selection, componentRegistry, cardSystem,
      scrollText: timeline.scrollText,
      camKeyframes: timeline.camKeyframes,
      input, gaze,
      entityManager: yuka.entityManager,
      vehicle: yuka.vehicle,
      boundaryBehavior: yuka.boundaryBehavior,
      mouseRepulsion: yuka.mouseRepulsion,
      wanderBehavior: yuka.wanderBehavior,
      state, modelRef, mixerRef, modelSettingsRef,
      actors, resolveElementObject: cam.resolveElementObject,
      cameraControls: cam.cameraControls,
      cameraHelper: cam.cameraHelper,
      pipViewport,
      lightHelpers,
      initialModelZ: ms0.positionZ,
      viewCube,
      holoScreenMatRef,
      holoScreenMats,
    });

    // ── Cleanup ───────────────────────────────────────────────────────────

    return () => {
      loopDisposable.dispose();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('overmind:camera-mode', onCameraMode);
      window.removeEventListener('overmind:pip-overlay-mount', onPipMount);
      window.removeEventListener('overmind:pip-overlay-unmount', onPipUnmount);
      viewCube.dispose();
      keyboardDisposable.dispose();
      gizmoDisposable.dispose();
      configDisposable.dispose();
      container.removeChild(rotHud);
      cam.cameraControls.dispose();
      cam.dispose();
      pipViewport.dispose();
      pipSub?.unsubscribe();
      lightHelpers.dispose();
      lightHelpersSub?.unsubscribe();
      window.removeEventListener('overmind:light-helper-attach', onLightHelperAttach);
      window.removeEventListener('overmind:light-helper-detach', onLightHelperDetach);
      detachInput();
      yuka.steeringSub?.unsubscribe();
      selection.dispose();
      gaze.dispose();
      componentRegistry.disposeAll(componentCtx);
      timeline.scrollText?.dispose();
      timeline.eyePathSystem?.dispose();
      timeline.timelineSub?.unsubscribe();
      timeline.selectionColorSub?.unsubscribe();
      modelDispose.dispose();
      secondaryModelDispose.dispose();
      cardHoloDisposes.forEach(d => d.dispose());
      spaceshipV1Dispose.dispose();
      state.cardClickSystem?.dispose();
      state.cardClickSystem = null;
      state.cardNoise?.dispose();
      state.cardNoise = null;
      state.cameraAnimator?.dispose();
      state.cameraAnimator = null;
      window.removeEventListener('overmind:camera-jump', onCameraJump);
      state.particleSystem?.dispose();
      if (secondaryModelRef.current) {
        scene.remove(secondaryModelRef.current);
        secondaryModelRef.current = null;
      }
      yuka.entityManager.clear();
      cardSystem.dispose();
      setCardPortals(new Map());
      composer.dispose();
      renderer.dispose();
      if (container.contains(cssRenderer.domElement)) {
        container.removeChild(cssRenderer.domElement);
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      modelRef.current = null;
      mixerRef.current = null;
    };
  }, [isRunning, basePath, bloomActor, lightsActor, materialActor, pbrActor, modelActor, sceneActor, performanceActor, revelationActor, steeringActor, timelineActor, selectionActor]);

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />
      {timelineActor && Array.from(cardPortals.entries()).map(([id, target]) =>
        createPortal(
          <ScrollCardContent3D key={id} actorRef={timelineActor} instanceId={id} />,
          target,
        )
      )}
    </>
  );
}
