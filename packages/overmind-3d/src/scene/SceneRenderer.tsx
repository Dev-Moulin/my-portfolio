import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { useOvermind } from '../hooks/useOvermind.ts';
import { createScene } from './sceneSetup.ts';
import { loadSecondaryModel, OVERMIND_IRIS_GLOW } from './modelLoader.ts';
import { OvermindPresentationSystem } from './overmindPresentationSystem.ts';
import { applyHoloScreensToCards, setHoloCardsLanguage, type HoloLang } from './holoScreenShader.ts';
import { applyHoloWalls } from './holoWallShader.ts';
import { MiniShipParticleSystem } from './miniShipParticles.ts';
import { applySunShader } from './sunShader.ts';
import { ScrollCameraAnimator } from './scrollCameraAnimator.ts';
import { OnboardingBridge } from './onboardingBridge.ts';
import { CardClickSystem } from './cardClickSystem.ts';
import { attachFreeLookDrag } from './freeLookDrag.ts';
import { CardNoiseSystem } from './cardNoiseSystem.ts';
import { InputTracker } from './inputTracker.ts';
import { SelectionSystem } from './selectionSystem.ts';
import { CardSystem } from './cardSystem.ts';
import { ComponentRegistry, asAnyDescriptor } from './componentRegistry.ts';
import { textDescriptor, lightDescriptor, cardDescriptor } from './descriptors/index.ts';
import { UndoRedoManager } from '../systems/UndoRedoManager.ts';
import { ScrollCardContent3D } from '../components/ScrollCard.tsx';
import type { SceneActors, SceneMutableState } from './sceneContext.ts';
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
import { SentinelCreatureSystem } from '../sentinelCreature/SentinelCreatureSystem.ts';
import { loadSpaceshipPaths } from '../sentinelCreature/spaceshipPaths.ts';
import { SentinelCurveEditor } from '../sentinelCreature/curveEditor.ts';
import { CameraPathEditor } from './cameraPathEditor.ts';
import { DownloadLogoSystem } from './downloadLogoSystem.ts';
import { LinkSystem } from './linkSystem.ts';
import { loadWanderNavigation, WanderNavigator } from '../sentinelCreature/wanderNavigation.ts';

// Install camera-controls with THREE subsets
CameraControls.install({ THREE });


export interface SceneRendererProps {
  basePath: string;
}

export function SceneRenderer({ basePath }: SceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardPortals, setCardPortals] = useState<Map<string, HTMLDivElement>>(new Map());

  const {
    bloomActor, lightsActor, materialActor, pbrActor,
    sceneActor, performanceActor, revelationActor,
    timelineActor, selectionActor, interactionModeActor, isRunning,
  } = useOvermind();

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

    const undoManager = (bloomActor && lightsActor && materialActor
      && sceneActor && timelineActor && selectionActor)
      ? new UndoRedoManager(
          {
            bloom: bloomActor, lights: lightsActor, material: materialActor,
            scene: sceneActor,
            timeline: timelineActor, selection: selectionActor,
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

    // ── Light helpers : créer le système + écouter les events AVANT CREATE_DEFAULT_LIGHTS.
    // Sinon les lumières par défaut dispatchent leur 'light-helper-attach' (send synchrone)
    // avant que le listener existe → aucun helper n'est jamais attaché (bug « 0 helper »).
    const lightHelpers = new LightHelperSystem(scene);
    const lightHelpersSub = sceneActor?.subscribe((snap) => {
      lightHelpers.setVisible(snap.context.lightHelpersVisible);
    });
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

    // ── 5. Actors bundle ──────────────────────────────────────────────────

    const actors: SceneActors = {
      bloomActor, lightsActor, materialActor, pbrActor,
      sceneActor, performanceActor, revelationActor,
      timelineActor, selectionActor, interactionModeActor,
    };

    // ── 6. Shared mutable state ───────────────────────────────────────────

    const state: SceneMutableState = {
      freeCameraActive: false,
      cachedElementTransforms: {},
      cachedCardOpacity: 0,
      cachedInstanceOpacities: {},
      steeringRanges: { xRange: 8, yDown: 3, yUp: 4, zBack: 5, zFront: 1.5 },
      cachedEyePathPosition: null,
      cachedEyePathBlend: 0,
      cachedEyePathRepulsionScale: 1,
      cachedEyePathTangent: null,
      cachedFollowPathStates: {},
      pipVisible: false,
      pipSize: 'S',
      anneauxMesh: null,
      anneaux2Mesh: null,
      ringSpeeds: { ring1: 0.12, ring2: -0.12 },
      extDetailsMesh: null,
      intDetailsMesh: null,
      intDetails001Mesh: null,
      particleSystem: null,
      sunMat: null,
      holoCardMats: [],
      holoCardEntries: [],
      // Langue initiale des cartes : cache i18next si présent, sinon FR (langue de build par défaut).
      cardLang: (localStorage.getItem('i18nextLng')?.startsWith('en') ? 'en' : 'fr') as HoloLang,
      holoWallMats: [],
      cameraAnimator: null,
      sentinelCreature: null,
      onboardingBridge: null,
      cardClickSystem: null,
      freeLookDetach: null,
      cardNoise: null,
      downloadLogo: null,
      trackToAssignments: {},
      overmindPresentation: null,
    };

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
      setCardPortals,
      toggleCameraMode: cam.toggleCameraMode,
      captureKeyframe: cam.captureKeyframe,
      insertInterpolatedKeyframe: cam.insertInterpolatedKeyframe,
      captureElementKeyframe: cam.captureElementKeyframe,
      broadcastUndoState,
      interactionModeActor,
    });

    // ── 11. Load model ────────────────────────────────────────────────────

    // Groupe 'iris' = source de vérité XState (materialMachine/pbrMachine) : le color panel
    // pilote la couleur de TOUS les matériaux du groupe. On y met l'iris Overmind ET l'iris
    // sentinelle → les deux suivent. Les 2 modèles chargent en async + SET_GROUP_MATERIALS
    // REMPLACE la liste → on garde les deux ensembles à part et on resynchronise la combinée.
    let integratedIrisMats: THREE.Material[] = [];   // iris de l'Overmind INTÉGRÉ (V2.8.3)
    let sentinelIrisMats: THREE.Material[] = [];
    const syncIrisGroup = () => {
      const combined = [...integratedIrisMats, ...sentinelIrisMats];
      if (combined.length === 0) return;
      materialActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'iris', materials: combined });
      pbrActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'iris', materials: combined });
    };
    // Groupe 'eyeRings' (anneaux de l'œil de l'Overmind intégré).
    let integratedEyeRingsMats: THREE.Material[] = [];
    const syncEyeRingsGroup = () => {
      const combined = [...integratedEyeRingsMats];
      if (combined.length === 0) return;
      materialActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'eyeRings', materials: combined });
      pbrActor?.send({ type: 'SET_GROUP_MATERIALS', group: 'eyeRings', materials: combined });
    };

    // ── 11c. Holo screen refs (kept for animation loop) ─────────────────
    const holoScreenMats: THREE.ShaderMaterial[] = [];
    const holoScreenMatRef: { current: THREE.ShaderMaterial | null } = { current: null };
    const cardHoloDisposes: { dispose: () => void }[] = [];

    // ── 11d. Load Spaceship model ─────────────────────────────
    // Refs pour l'éditeur de courbe sentinelle (créé à la demande via le DevPanel)
    let spaceshipModel: THREE.Object3D | null = null;
    let spaceshipPathsData: import('../sentinelCreature/spaceshipPaths.ts').SpaceshipPathsData | null = null;
    let curveEditor: SentinelCurveEditor | null = null;
    let cameraEditor: CameraPathEditor | null = null;
    let linkSystem: LinkSystem | null = null;
    let cameraABSamples: { f: number; pos_three: [number, number, number] }[] | null = null;

    const spaceshipV1Dispose = loadSecondaryModel(scene, basePath, 'Spaceship_NewV2.8.3_DracoKTX2.glb', renderer, (model, animations) => {
      model.position.set(20, 3, -5);
      model.scale.setScalar(1 / 4);  // scale down 2.5x
      model.userData.selectableId = 'spaceship-v1';
      selection.register('spaceship-v1', model);
      selectionActor?.send({ type: 'REGISTER_ID', id: 'spaceship-v1' });

      // Masquer les proxies de collision / helpers de nav embarqués (par erreur) dans le GLB
      // visible : COL_BOX_* (boîtes de non-accès), volumes de zone Wander.00X, WanderOvermind.
      // Ils ne servent qu'à la collision/nav, jamais au rendu. (extractZoneGeometry lit la géo
      // même masquée → aucun impact sur le wander/Overmind.)
      model.traverse((o) => {
        const n = o.name.replace(/\./g, '');
        if (/^COL_BOX/.test(n) || /^Wander00[123]$/.test(n) || n === 'WanderOvermind') {
          o.visible = false;
        }
      });

      // Find Anneaux mesh + Spaceship_Base material for texture swap
      // V5.2: node names use ".001"/".003"/".004" suffix (with period). Older V2 used "001"/"003"/"004".
      // We accept both forms for backward compatibility while V2 still exists.
      let baseMaterial: THREE.Material | THREE.Material[] | null = null;
      const SWAP_TARGETS = new Set([
        // V5.2 names
        'Spaceship_Interior_Details.003_gameasset',
        'Spaceship_Interior_Details.004_gameasset',
        // V2 names (kept as fallback)
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

      // ── DEBUG: Eye mesh material tweaking (find which mesh causes the harsh reflection)
      interface EyeMatSnapshot {
        metalness: number;
        roughness: number;
        emissive: number;          // hex color
        emissiveIntensity: number;
        color: number;             // hex color
      }
      const eyeMeshes = new Map<string, THREE.Mesh>();
      const eyeOriginalMat = new Map<string, EyeMatSnapshot>();
      model.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const n = child.name;
        if (/Eye_Iris|Eyelid|Pupil|Scleral|Conjunctiva/i.test(n)) {
          eyeMeshes.set(n, child as THREE.Mesh);
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat && 'metalness' in mat) {
            eyeOriginalMat.set(n, {
              metalness: mat.metalness ?? 0,
              roughness: mat.roughness ?? 1,
              emissive: mat.emissive?.getHex() ?? 0,
              emissiveIntensity: mat.emissiveIntensity ?? 1,
              color: mat.color?.getHex() ?? 0xffffff,
            });
          }
        }
      });
      console.log('[Eye debug] meshes found:', Array.from(eyeMeshes.keys()));
      console.log('[Eye debug] Use testEye("list") to see ALL material properties (emissive, intensity, etc.)');

      // Scleral/Conjunctiva : la texture bloomait trop. Couper l'émissif ne suffisait pas —
      // le bloom venait surtout de l'ALBÉDO blanc trop clair (même symptôme que le hull). On
      // applique la même recette que HULL_GLOW_DIM : albédo assombri + émissif tué + toneMapping
      // forcé (borne la luminance sous le seuil de bloom). Réglable : testEye('Scleral_Conjunctiva001',
      // { color: 0x808080 }) ; 'reset' restaure tout (albédo inclus).
      const SCLERA_ALBEDO_DIM = 0.45; // ↓ = plus sombre / moins de bloom
      let scleraFixed = 0;
      for (const [name, mesh] of eyeMeshes) {
        if (!/Scleral|Conjunctiva/i.test(name)) continue;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat || !('emissiveIntensity' in mat)) continue;
        mat.emissiveIntensity = 0;
        if (mat.emissive) mat.emissive.setHex(0x000000);
        if (mat.color) mat.color.multiplyScalar(SCLERA_ALBEDO_DIM);
        mat.toneMapped = true;
        mat.needsUpdate = true;
        scleraFixed++;
      }
      console.log(`[Eye debug] Scleral/Conjunctiva anti-bloom (albédo ×${SCLERA_ALBEDO_DIM} + émissif coupé + toneMapped): ${scleraFixed} mesh(es)`);

      // Iris sentinelle : Paul ne veut du glow/bloom QUE sur Pupil.001. On éteint donc tout
      // émissif sur Eye_Iris.001 (il garde son matériau sombre « Glossy Black Panels » → ne
      // déclenche plus le bloom) et on ne le branche PAS au groupe 'iris' (le color-panel ne
      // pilote que l'Overmind). La pupille garde son émissif plasma du GLB → seule elle glow.
      for (const [name, mesh] of eyeMeshes) {
        if (!/Iris/i.test(name)) continue;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mm of mats) {
          const mat = mm as THREE.MeshStandardMaterial;
          if (!mat || !('emissive' in mat)) continue;
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
          mat.needsUpdate = true;
        }
      }
      sentinelIrisMats = [];
      syncIrisGroup(); // iris sentinelle exclu du groupe → color-panel = Overmind seul
      console.log('[Eye debug] iris sentinelle ÉTEINTE (glow/bloom réservé à Pupil.001)');

      // NewV1.1: eyelid emissive intensities are fixed at the Blender source (no more
      // runtime clamp needed — the old V6.1 export had emissiveIntensity=53.32).
      // Expose a helper to tweak eye meshes from the DevTools console:
      //   testEye('Eye_Iris', { metalness: 0, roughness: 1 })
      //   testEye('Eye_Iris', { emissiveIntensity: 0 })   // kill emission (likely the bloom source)
      //   testEye('Eye_Iris', { emissive: 0 })            // also kill emissive color
      //   testEye('Eye_Iris', 'reset')                     // restore original values
      //   testEye('list')                                  // print all current values
      interface TweakOptions {
        metalness?: number;
        roughness?: number;
        emissive?: number;
        emissiveIntensity?: number;
        color?: number;
      }
      (window as unknown as { testEye: (name: string, action?: 'reset' | TweakOptions) => void }).testEye = (name, action) => {
        if (name === 'list') {
          for (const [k, mesh] of eyeMeshes) {
            const m = mesh.material as THREE.MeshStandardMaterial;
            const hex = m.emissive ? '#' + m.emissive.getHexString() : '?';
            console.log(`  ${k}: metalness=${m.metalness?.toFixed(2)} roughness=${m.roughness?.toFixed(2)} emissive=${hex} emissiveIntensity=${m.emissiveIntensity?.toFixed(2)}`);
          }
          return;
        }
        const mesh = eyeMeshes.get(name);
        if (!mesh) { console.warn(`[testEye] no mesh "${name}". Known:`, Array.from(eyeMeshes.keys())); return; }
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        if (action === 'reset') {
          const orig = eyeOriginalMat.get(name);
          if (orig) {
            mat.metalness = orig.metalness;
            mat.roughness = orig.roughness;
            mat.emissive.setHex(orig.emissive);
            mat.emissiveIntensity = orig.emissiveIntensity;
            mat.color.setHex(orig.color);
            mat.toneMapped = true;
          }
        } else if (action && typeof action === 'object') {
          if (action.metalness !== undefined) mat.metalness = action.metalness;
          if (action.roughness !== undefined) mat.roughness = action.roughness;
          if (action.emissive !== undefined) mat.emissive.setHex(action.emissive);
          if (action.emissiveIntensity !== undefined) mat.emissiveIntensity = action.emissiveIntensity;
          if (action.color !== undefined) mat.color.setHex(action.color);
        }
        mat.needsUpdate = true;
        mesh.material = mat;
        const hex = '#' + mat.emissive.getHexString();
        console.log(`[testEye] ${name} → metalness=${mat.metalness.toFixed(2)} roughness=${mat.roughness.toFixed(2)} emissive=${hex} emissiveIntensity=${mat.emissiveIntensity.toFixed(2)}`);
      };

      // Generic material tweaker for ANY mesh of the model (DevTools console):
      //   testMat('list')                 → every mesh with an emissive material
      //   testMat('list', 0)              → every mesh material (min intensity 0)
      //   testMat('Mesh_Name', { emissiveIntensity: 0.2, metalness: 0, roughness: 1, emissive: 0xff0000 })
      (window as unknown as { testMat: (name: string, action?: TweakOptions | number) => void }).testMat = (name, action) => {
        if (name === 'list') {
          const min = typeof action === 'number' ? action : 0.01;
          model.traverse((child) => {
            if (!(child as THREE.Mesh).isMesh) return;
            const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (!m || !('emissiveIntensity' in m)) return;
            const ei = m.emissiveIntensity ?? 0;
            const hasColor = m.emissive && m.emissive.getHex() !== 0;
            if (ei >= min && (hasColor || min <= 0)) {
              console.log(`  ${child.name}: emissive=#${m.emissive?.getHexString()} intensity=${ei.toFixed(2)} metal=${m.metalness?.toFixed(2)} rough=${m.roughness?.toFixed(2)} (mat: ${m.name || '?'})`);
            }
          });
          return;
        }
        const target = model.getObjectByName(name) as THREE.Mesh | undefined;
        if (!target || !target.isMesh) { console.warn(`[testMat] no mesh "${name}"`); return; }
        const mat = (target.material as THREE.MeshStandardMaterial).clone();
        if (action && typeof action === 'object') {
          if (action.metalness !== undefined) mat.metalness = action.metalness;
          if (action.roughness !== undefined) mat.roughness = action.roughness;
          if (action.emissive !== undefined) mat.emissive.setHex(action.emissive);
          if (action.emissiveIntensity !== undefined) mat.emissiveIntensity = action.emissiveIntensity;
        }
        mat.needsUpdate = true;
        target.material = mat;
        console.log(`[testMat] ${name} → metalness=${mat.metalness.toFixed(2)} roughness=${mat.roughness.toFixed(2)} emissive=#${mat.emissive.getHexString()} emissiveIntensity=${mat.emissiveIntensity.toFixed(2)}`);
      };

      // Hide the Blender rig helpers that exported WITH a mesh (the cube + icosphere
      // seen at point A): PATH_ROOT (cube) + PHYS_SENTINEL (icosphere). CAUTION:
      // PHYS_SENTINEL is an ANCESTOR of the creature (PHYS_SENTINEL → BANK_CTRL →
      // Eye_Rig.001) AND GLTFLoader makes the node itself the Mesh — so we can't use
      // `visible = false` (inherited by the whole subtree). Instead we make its
      // MATERIAL invisible: only its own render is skipped, children are untouched.
      {
        const pathRoot = model.getObjectByName('PATH_ROOT');
        if (pathRoot) pathRoot.visible = false; // no children → safe to hide entirely
        const physSentinel = model.getObjectByName('PHYS_SENTINEL');
        let physHidden = false;
        if (physSentinel) {
          const hideOwnMesh = (obj: THREE.Object3D) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mat = (mesh.material as THREE.Material).clone();
            mat.visible = false;
            mesh.material = mat;
            physHidden = true;
          };
          hideOwnMesh(physSentinel); // node-as-Mesh case (single primitive)
          for (const child of physSentinel.children) {
            // multi-primitive case: GLTFLoader wraps meshes as direct children
            if ((child as THREE.Mesh).isMesh) hideOwnMesh(child);
          }
        }
        console.log(`[SceneRenderer] rig helpers hidden: PATH_ROOT=${!!pathRoot} PHYS_SENTINEL icosphere=${physHidden}`);
      }

      // The NewV1.1 export carries BOTH the working spaceship AND the old "GameReady"
      // collection (*_gameasset) — most pieces are exact overlapping duplicates.
      // Hide every *_gameasset mesh that has a working-version twin (same name
      // without the suffix) at the SAME world position. Unique _gameasset meshes
      // (holo card screens, Sun, cadres) and the offset Anneaux_gameasset ring stay.
      {
        const a = new THREE.Vector3(), b = new THREE.Vector3();
        const toHide: THREE.Object3D[] = [];
        model.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh || !child.name.includes('_gameasset')) return;
          const twin = model.getObjectByName(child.name.replace('_gameasset', ''));
          if (!twin || twin === child) return;
          child.getWorldPosition(a);
          twin.getWorldPosition(b);
          if (a.distanceTo(b) < 0.05) toHide.push(child);
        });
        for (const c of toHide) c.visible = false;
        console.log(`[SceneRenderer] GameReady duplicates hidden: ${toHide.length}`, toHide.map(c => c.name));
      }

      // Navigation DATA objects must never render: the wander zones/path surfaces
      // (Wander.001/002/003, Sentinel_Wander_Path) and any curve objects (Sentinel/
      // Bézier curves — usually exported without geometry, but hidden defensively in
      // case a future export gives them a mesh). The real navigation reads the JSON.
      {
        const hidden: string[] = [];
        const isNavData = (n: string) =>
          n.startsWith('Wander') || n.startsWith('Sentinel_Wander') ||
          n.includes('Curve') || n.startsWith('Bézier') || n.startsWith('Bezier');
        model.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          if (isNavData(child.name)) { child.visible = false; hidden.push(child.name); }
        });
        console.log(`[SceneRenderer] nav data meshes hidden: ${hidden.length}`, hidden);
      }

      // Second pass: apply base material to targets + fix alpha + find Anneaux
      // Accept both V5.2 (".001" with period) and V2 ("001" no period) naming.
      model.traverse((child) => {
        // V1.2: rings are "Anneaux" (centre) + "Anneaux.001" (offset, scaled).
        // (V1.1 used "Anneaux_gameasset"/"Anneaux" — kept as fallback.)
        if (child.name === 'Anneaux' || child.name === 'Anneaux_gameasset') state.anneauxMesh = child;
        if (child.name === 'Anneaux.001' || child.name === 'Anneaux001') state.anneaux2Mesh = child;
        if (child.name === 'Spaceship_Exterieur_Details_Alpha_gameasset') state.extDetailsMesh = child;
        if (child.name === 'Spaceship_Interior_Details_gameasset') state.intDetailsMesh = child;
        if (child.name === 'Spaceship_Interior_Details.001_gameasset' || child.name === 'Spaceship_Interior_Details001_gameasset') state.intDetails001Mesh = child;
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

      // The GameReady duplicates above are hidden — retarget the animated/tweaked
      // meshes onto their working-version twins (dots stripped by GLTFLoader).
      state.extDetailsMesh = model.getObjectByName('Spaceship_Exterieur_Details_Alpha') ?? state.extDetailsMesh;
      state.intDetailsMesh = model.getObjectByName('Spaceship_Interior_Details') ?? state.intDetailsMesh;
      state.intDetails001Mesh = model.getObjectByName('Spaceship_Interior_Details001')
        ?? model.getObjectByName('Spaceship_Interior_Details.001')
        ?? state.intDetails001Mesh;

      // Paul's feedback: the two hull meshes "Spaceship_Exterieur_Details_Alpha" and
      // "Spaceship_Interior_Details" glow under the global bloom. They share the
      // material "Spaceship_Exterieur_Details_Alpha", which EMITS NOTHING (emissive
      // [0,0,0]) — so killing emission does nothing. The glow comes from their albedo
      // being pushed bright by the strong ambient light (intensity 4), tripping the
      // bloom threshold. Fix: dim their albedo so the lit pixels fall back under the
      // threshold. Shared material → affects exactly these two meshes; the bright
      // "Spaceship_Interior_Details.001" uses a DIFFERENT material and is untouched.
      const HULL_GLOW_DIM = 0.4; // tune: lower = darker / less glow, higher = brighter
      {
        const hullMeshes = ['Spaceship_Exterieur_Details_Alpha', 'Spaceship_Interior_Details']
          .map((n) => model.getObjectByName(n) as THREE.Mesh | undefined)
          .filter((m): m is THREE.Mesh => !!m && m.isMesh);
        let dimmedMat: THREE.MeshStandardMaterial | null = null;
        for (const mesh of hullMeshes) {
          if (!dimmedMat) {
            dimmedMat = (mesh.material as THREE.MeshStandardMaterial).clone();
            dimmedMat.color.multiplyScalar(HULL_GLOW_DIM); // assombrit l'albédo (texture × color)
            dimmedMat.emissive.setHex(0x000000);
            dimmedMat.emissiveIntensity = 0;
            dimmedMat.needsUpdate = true;
          }
          mesh.material = dimmedMat;
        }
        console.log(`[SceneRenderer] hull glow dimmed (albedo ×${HULL_GLOW_DIM}) on:`, hullMeshes.map((m) => m.name));
      }

      // Init mini ship particle system (circuit fermé Bézier ; basePath → fetch de la courbe)
      state.particleSystem = new MiniShipParticleSystem(model, scene, basePath);

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

      // Données caméra AB (pour l'éditeur de trajectoire) + offsets figés éventuels.
      fetch(`${basePath}data/Cameras_motion_profiles.json`).then(r => r.json()).then(j => {
        cameraABSamples = j?.segments?.AB?.samples ?? null;
      }).catch(() => { /* optionnel */ });
      fetch(`${basePath}data/Camera_AB_offsets.json`).then(r => (r.ok ? r.json() : null)).then(d => {
        if (d?.offsets) cameraAnimator.setCameraABOffset(d);
      }).catch(() => { /* pas encore figé */ });
      // FOV animé (BD/CB/DB) : courbe frame→yfov non exportable en glTF, rejouée sur camera.fov.
      fetch(`${basePath}data/Cameras_fov_V2.1.json`).then(r => (r.ok ? r.json() : null)).then(d => {
        if (d?.clips) cameraAnimator.setFovCurves(d);
      }).catch(() => { /* optionnel — fallback fovStart/fovEnd */ });

      // Live sentinel creature: path follow synced to scroll + wiggle + SH shader.
      // Async — fetches the Bézier paths JSON exported alongside the GLB.
      spaceshipModel = model;
      // Overmind INTÉGRÉ au vaisseau (OVM_ROOT) : bras en boucle (repos) + présentation
      // périodique d'un objet (anneaux / BTC / ETH). Un seul système, mixer sur OVM_ROOT (les
      // bones aux noms dupliqués dans le GLB brut sont dédupliqués par GLTFLoader → résolus ici).
      const ovmRoot = model.getObjectByName('OVM_ROOT');
      if (ovmRoot) {
        state.overmindPresentation = new OvermindPresentationSystem(ovmRoot, animations, camera);
        // Iris + anneaux de l'œil de l'intégré → branchés au color-panel (mêmes groupes que le V4.2).
        const iris: THREE.Material[] = [];
        const eyeRings: THREE.Material[] = [];
        ovmRoot.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          if (child.name === 'IRIS') iris.push(...mats);
          else if (child.name === 'Anneaux_Eye_Ext' || child.name === 'Anneaux_Eye_Int') eyeRings.push(...mats);
        });
        // Look de base cyan (comme le V4.2) ; le color-panel prend ensuite le relais.
        const cyan = new THREE.Color(OVERMIND_IRIS_GLOW.color);
        for (const m of iris) {
          if ('emissive' in m) {
            const sm = m as THREE.MeshStandardMaterial;
            sm.emissive.copy(cyan);
            sm.emissiveIntensity = OVERMIND_IRIS_GLOW.intensity;
            sm.needsUpdate = true;
          }
        }
        integratedIrisMats = iris;
        integratedEyeRingsMats = eyeRings;
        syncIrisGroup();
        syncEyeRingsGroup();
        console.log(`[SceneRenderer] Overmind intégré : iris ${iris.length} mat, eyeRings ${eyeRings.length} mat branchés au color-panel`);
      } else {
        console.warn('[SceneRenderer] OVM_ROOT introuvable dans le GLB — Overmind intégré non animé');
      }

      loadSpaceshipPaths(basePath).then(({ data, sentinelAB }) => {
        spaceshipPathsData = data;
        const creature = new SentinelCreatureSystem(model, sentinelAB, camera);
        state.sentinelCreature = creature;
        creature.setCameraAnimator(cameraAnimator); // orientation de repos (Fix A1) + resync au saut
        cameraAnimator.setProgressListener((p) => creature.setScrollProgress(p));
        // Onboarding B : la machine XState (via le bridge) orchestre accroche + biais caméra 4° +
        // verrou nav + détour scroll + bulle, déclenchée par l'arrivée en B via le trajet AB.
        state.onboardingBridge = new OnboardingBridge(creature, cameraAnimator, camera, linkSystem, () => state.holoCardMats);
        // Clip baké `wander_B` (dans le GLB) : nage chorégraphiée pendant le repos en zone B.
        const wanderClip = THREE.AnimationClip.findByName(animations, 'wander_B');
        if (wanderClip) creature.setWanderClip(wanderClip);
        else console.warn('[SceneRenderer] clip "wander_B" absent du GLB — wander B reste procédural');
        // Clip baké `sentinel_AB` (V2.4) : trajet AB scrubé + crossfade natif ↔ wander_B.
        // APRÈS setWanderClip (le mixer y est créé). Absent → fallback profil JSON ci-dessous.
        const sentinelABClip = THREE.AnimationClip.findByName(animations, 'sentinel_AB');
        if (sentinelABClip) creature.setSentinelABClip(sentinelABClip);
        else console.warn('[SceneRenderer] clip "sentinel_AB" absent du GLB — AB reste sur le profil JSON');
        // Trajets bakés V2.7 (déroulé complet 2026-07-07, après validation du pilote BC) : les 6
        // trajets + leurs variantes _v2/_v3 (mêmes fenêtres caméra — la variante est choisie AU
        // DÉPART par proximité de la frame 0) + les nages de zone C/D. Un clip absent du GLB →
        // warn + fallback procédural naturel pour ce segment/cette zone.
        for (const zone of ['C', 'D'] as const) {
          const clip = THREE.AnimationClip.findByName(animations, `wander_${zone}`);
          if (clip) creature.setZoneWanderClip(zone, clip);
          else console.warn(`[SceneRenderer] clip "wander_${zone}" absent du GLB — zone ${zone} reste procédurale`);
        }
        const trajetClips: [string, string][] = [
          ['BC', 'sentinel_BC'],
          ['CD', 'sentinel_CD'], ['CD', 'sentinel_CD_v2'], ['CD', 'sentinel_CD_v3'],
          ['DC', 'sentinel_DC'], ['DC', 'sentinel_DC_v2'],
          ['CB', 'sentinel_CB'], ['CB', 'sentinel_CB_v2'], ['CB', 'sentinel_CB_v3'],
          ['DB', 'sentinel_DB'],
          ['BD', 'sentinel_BD'],
        ];
        for (const [segment, name] of trajetClips) {
          const clip = THREE.AnimationClip.findByName(animations, name);
          if (clip) creature.setTrajetClip(segment, clip);
          else console.warn(`[SceneRenderer] clip "${name}" absent du GLB — trajet ${segment} sans cette variante`);
        }
        // Wander navigation (B/C/D zones + trajectories), async — Blender Z-up JSON.
        loadWanderNavigation(basePath).then((navData) => {
          creature.setWanderNavigator(new WanderNavigator(navData, camera, model));
        }).catch((err) => {
          console.warn('[SceneRenderer] wander navigation JSON missing — B/C/D wander disabled:', err);
        });
      }).catch((err) => {
        console.warn('[SceneRenderer] sentinel paths JSON missing — creature stays static:', err);
      });

      // Init card noise (subtle XYZ position oscillation on Card1/2/3 meshes)
      state.cardNoise = new CardNoiseSystem(model);

      // Logo download animé sur Card1 (anim rejouée en JS, non exportée)
      state.downloadLogo = new DownloadLogoSystem(model);

      // Liens cliquables : logos réseaux + textes démo (glow bleu + clic → URL)
      linkSystem = new LinkSystem(model, camera, renderer, scene);

      // Apply holographic shader to walls with scrolling logos (async, awaits SVG load)
      applyHoloWalls(model, basePath).then(walls => {
        state.holoWallMats = walls;
      });

      // Apply holographic shader to card screens (async — awaits fonts + profile image)
      applyHoloScreensToCards(model).then(holoCardEntries => {
        state.holoCardMats = holoCardEntries.map(e => e.material);
        state.holoCardEntries = holoCardEntries;
        cameraAnimator.setCardEntries(holoCardEntries);
        state.cardClickSystem = new CardClickSystem(camera, renderer, holoCardEntries, cameraAnimator);
        // Free-look 360° (drag « tirer le monde », V1 desktop) — clic-cartes protégé par seuil.
        state.freeLookDetach = attachFreeLookDrag(cameraAnimator);
        // Cartes bâties en FR par défaut → si la langue courante est EN, régénérer les textures.
        if (state.cardLang === 'en') setHoloCardsLanguage(holoCardEntries, 'en');
      });
    });

    // Listener pour les boutons dev "Goto A/B/C/D"
    const onCameraJump = (e: Event) => {
      const point = (e as CustomEvent<'A' | 'B' | 'C' | 'D'>).detail;
      state.cameraAnimator?.jumpToPoint(point);
      // Téléportation : re-synchronise l'anim de la Sentinelle (mixers/flags) → repart propre au
      // nouveau point (règle l'accroche ratée + les décalages de position après nav).
      state.sentinelCreature?.resyncOnJump(point);
    };
    window.addEventListener('overmind:camera-jump', onCameraJump);

    // Langue des cartes holo (FR/EN) — relayée depuis i18n via LanguageBridge (apps/web).
    const onLanguageChange = (e: Event) => {
      const raw = (e as CustomEvent<string>).detail;
      const lang: HoloLang = raw === 'fr' ? 'fr' : 'en';
      state.cardLang = lang;
      if (state.holoCardEntries.length) setHoloCardsLanguage(state.holoCardEntries, lang);
    };
    window.addEventListener('overmind:language-change', onLanguageChange);

    // Listener pour la vue élargie au repos (recul + FOV par point B/C/D)
    const onRestView = (e: Event) => {
      const d = (e as CustomEvent<{ point: 'A' | 'B' | 'C' | 'D'; back?: number; fov?: number; export?: boolean }>).detail;
      if (d.export) {
        console.log('[RestView] réglages actuels:', JSON.stringify(state.cameraAnimator?.getRestViews()));
        return;
      }
      state.cameraAnimator?.setRestView(d.point, { back: d.back, fov: d.fov });
    };
    window.addEventListener('overmind:rest-view', onRestView);

    // Listener pour le look-around souris (parallax au repos + free-look drag 360°)
    const onLookAround = (e: Event) => {
      const d = (e as CustomEvent<Partial<import('./scrollCameraAnimator.ts').LookAroundConfig> & { export?: boolean }>).detail;
      if (d.export) {
        console.log('[LookAround] réglages actuels:', JSON.stringify(state.cameraAnimator?.getLookConfig()));
        return;
      }
      state.cameraAnimator?.setLookConfig(d);
    };
    window.addEventListener('overmind:look-around', onLookAround);

    // Listener pour la section "Anneaux" du DevPanel (vitesse + scale des 2 anneaux)
    const onRingsConfig = (e: Event) => {
      const d = (e as CustomEvent<{ ring: 1 | 2; speed?: number; scaleX?: number; scaleY?: number; scaleZ?: number }>).detail;
      if (d.speed !== undefined) {
        if (d.ring === 1) state.ringSpeeds.ring1 = d.speed;
        else state.ringSpeeds.ring2 = d.speed;
      }
      const mesh = d.ring === 1 ? state.anneauxMesh : state.anneaux2Mesh;
      if (mesh) {
        if (d.scaleX !== undefined) mesh.scale.x = d.scaleX;
        if (d.scaleY !== undefined) mesh.scale.y = d.scaleY;
        if (d.scaleZ !== undefined) mesh.scale.z = d.scaleZ;
      }
    };
    window.addEventListener('overmind:rings-config', onRingsConfig);

    // Listener pour le debug sentinelle (sphère wireframe de la zone de wander en B)
    const onSentinelDebug = (e: Event) => {
      const d = (e as CustomEvent<{ zones?: boolean; trajectories?: boolean }>).detail;
      state.sentinelCreature?.setWanderDebug(d);
    };
    window.addEventListener('overmind:sentinel-debug', onSentinelDebug);

    // Listeners fenêtre Transitions : overlap AB↔wander_B, fondu accroche + flux debug.
    const onSentinelXfade = (e: Event) => {
      const d = (e as CustomEvent<{ abFrames?: number; wanderFrames?: number; accFrames?: number; accDrift?: number; departFrames?: number; forcedVariant?: number | null }>).detail;
      if (d.abFrames !== undefined) state.sentinelCreature?.setXfadeAbFrames(d.abFrames);
      if (d.wanderFrames !== undefined) state.sentinelCreature?.setXfadeWanderFrames(d.wanderFrames);
      if (d.accFrames !== undefined) state.sentinelCreature?.setAccXfadeFrames(d.accFrames);
      if (d.accDrift !== undefined) state.sentinelCreature?.setAccrocheDrift(d.accDrift);
      if (d.departFrames !== undefined) state.sentinelCreature?.setXfadeDepartFrames(d.departFrames);
      if (d.forcedVariant !== undefined) state.sentinelCreature?.setTrajetForcedVariant(d.forcedVariant);
    };
    window.addEventListener('overmind:sentinel-xfade', onSentinelXfade);
    const onSentinelAnimDebug = (e: Event) => {
      state.sentinelCreature?.setAnimDebug((e as CustomEvent<{ enabled: boolean }>).detail.enabled);
    };
    window.addEventListener('overmind:sentinel-anim-debug', onSentinelAnimDebug);

    // Listener pour l'entrée scénarisée de la sentinelle (plongeon depuis hors-champ au start AB)
    const onSentinelEntry = (e: Event) => {
      const d = (e as CustomEvent<{ back?: number; up?: number; catchUp?: number; export?: boolean }>).detail;
      if (d.export) {
        console.log('[SentinelEntry] réglages actuels:', JSON.stringify(state.sentinelCreature?.getEntryConfig()));
        return;
      }
      state.sentinelCreature?.setEntryConfig(d);
    };
    window.addEventListener('overmind:sentinel-entry', onSentinelEntry);

    // Listener pour l'éditeur de courbe sentinelle (toggle + export depuis le DevPanel)
    const onCurveEditor = (e: Event) => {
      const d = (e as CustomEvent<{ enabled?: boolean; export?: boolean }>).detail;
      if (d.enabled !== undefined) {
        if (d.enabled && !curveEditor) {
          if (!spaceshipModel || !spaceshipPathsData) {
            console.warn('[SceneRenderer] curve editor: model or paths JSON not loaded yet');
          } else {
            curveEditor = new SentinelCurveEditor(spaceshipModel, spaceshipPathsData, selection,
              (curve) => state.sentinelCreature?.setCurve(curve));
          }
        } else if (!d.enabled && curveEditor) {
          curveEditor.dispose();
          curveEditor = null;
        }
      }
      if (d.export) curveEditor?.exportJSON();
    };
    window.addEventListener('overmind:curve-editor', onCurveEditor);

    // Listener pour l'éditeur de trajectoire caméra AB (frames 53-260 : offset de position).
    const onCameraEditor = (e: Event) => {
      const d = (e as CustomEvent<{ enabled?: boolean; export?: boolean }>).detail;
      if (d.enabled !== undefined) {
        if (d.enabled && !cameraEditor) {
          if (!spaceshipModel || !cameraABSamples) {
            console.warn('[SceneRenderer] camera editor: modèle ou données caméra AB pas encore chargés');
          } else {
            cameraEditor = new CameraPathEditor(
              scene, spaceshipModel, cameraABSamples, selection,
              (off) => state.cameraAnimator?.setCameraABOffset(off),
              state.cameraAnimator?.getCameraABOffset() ?? null,
            );
          }
        } else if (!d.enabled && cameraEditor) {
          cameraEditor.dispose();
          cameraEditor = null;
        }
      }
      if (d.export) cameraEditor?.exportJSON();
    };
    window.addEventListener('overmind:camera-editor', onCameraEditor);

    // Listener pour les mini-vaisseaux (vitesse, densité, taille, zone de masquage, debug courbe)
    const onParticlesConfig = (e: Event) => {
      const d = (e as CustomEvent<{
        speed?: number; count?: number; shipScale?: number; showPaths?: boolean;
        fadeZone?: { start: number; end: number };
        motion?: {
          spread?: number; speedVar?: number; laneAmp?: number;
          swayAmp?: number; swayFreq?: number; rollFraction?: number; bank?: number;
        };
        circuits?: { count: number; angleDeg: number };
      }>).detail;
      const ps = state.particleSystem;
      if (!ps) return;
      if (d.speed !== undefined) ps.setSpeed(d.speed);
      if (d.count !== undefined) ps.setTargetCount(d.count);
      if (d.shipScale !== undefined) ps.setShipScale(d.shipScale);
      if (d.fadeZone) ps.setFadeZone(d.fadeZone.start, d.fadeZone.end);
      if (d.motion) ps.setMotion(d.motion);
      if (d.circuits) ps.setCircuits(d.circuits.count, d.circuits.angleDeg);
      if (d.showPaths !== undefined) ps.setPathsVisible(d.showPaths);
    };
    window.addEventListener('overmind:particles-config', onParticlesConfig);

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

    // ── 14. Input ─────────────────────────────────────────────────────────

    const input = new InputTracker();
    const detachInput = input.attach();

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
      input,
      state,
      actors, resolveElementObject: cam.resolveElementObject,
      cameraControls: cam.cameraControls,
      cameraHelper: cam.cameraHelper,
      pipViewport,
      lightHelpers,
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
      selection.dispose();
      componentRegistry.disposeAll(componentCtx);
      timeline.scrollText?.dispose();
      timeline.eyePathSystem?.dispose();
      timeline.timelineSub?.unsubscribe();
      timeline.selectionColorSub?.unsubscribe();
      cardHoloDisposes.forEach(d => d.dispose());
      spaceshipV1Dispose.dispose();
      state.cardClickSystem?.dispose();
      state.cardClickSystem = null;
      state.freeLookDetach?.();
      state.freeLookDetach = null;
      state.cardNoise?.dispose();
      state.cardNoise = null;
      state.downloadLogo?.dispose();
      state.downloadLogo = null;
      state.onboardingBridge?.dispose();
      state.onboardingBridge = null;
      state.cameraAnimator?.dispose();
      state.sentinelCreature?.dispose();
      state.cameraAnimator = null;
      window.removeEventListener('overmind:camera-jump', onCameraJump);
      window.removeEventListener('overmind:language-change', onLanguageChange);
      window.removeEventListener('overmind:rest-view', onRestView);
      window.removeEventListener('overmind:look-around', onLookAround);
      window.removeEventListener('overmind:sentinel-entry', onSentinelEntry);
      state.overmindPresentation?.dispose();
      state.overmindPresentation = null;
      window.removeEventListener('overmind:rings-config', onRingsConfig);
      window.removeEventListener('overmind:sentinel-debug', onSentinelDebug);
      window.removeEventListener('overmind:sentinel-xfade', onSentinelXfade);
      window.removeEventListener('overmind:sentinel-anim-debug', onSentinelAnimDebug);
      window.removeEventListener('overmind:curve-editor', onCurveEditor);
      window.removeEventListener('overmind:camera-editor', onCameraEditor);
      window.removeEventListener('overmind:particles-config', onParticlesConfig);
      curveEditor?.dispose();
      curveEditor = null;
      cameraEditor?.dispose();
      cameraEditor = null;
      linkSystem?.dispose();
      linkSystem = null;
      state.particleSystem?.dispose();
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
    };
  }, [isRunning, basePath, bloomActor, lightsActor, materialActor, pbrActor, sceneActor, performanceActor, revelationActor, timelineActor, selectionActor]);

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
