import * as THREE from 'three';
import type CameraControls from 'camera-controls';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry } from './componentRegistry.ts';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { LightExtra } from './descriptors/lightDescriptor.ts';
import type { CardSystem } from './cardSystem.ts';
import type { ScrollTextSystem } from './scrollText.ts';
import type { CameraKeyframeSystem } from './cameraKeyframes.ts';
import type { InputTracker } from './inputTracker.ts';
import type { SceneActors, SceneMutableState, Disposable } from './sceneContext.ts';
import { InfiniteGrid } from './infiniteGrid.ts';

export interface AnimationLoopDeps {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cssRenderer: CSS3DRenderer;
  composer: EffectComposer;
  scene: THREE.Scene;
  selection: SelectionSystem;
  componentRegistry: ComponentRegistry;
  cardSystem: CardSystem;
  scrollText: ScrollTextSystem | null;
  camKeyframes: CameraKeyframeSystem | null;
  input: InputTracker;
  state: SceneMutableState;
  actors: SceneActors;
  resolveElementObject: (id: string) => THREE.Object3D | null;
  cameraControls: CameraControls;
  cameraHelper: THREE.CameraHelper | null;
  pipViewport: import('./pipViewport.ts').PIPViewport | null;
  lightHelpers: import('./lightHelperSystem.ts').LightHelperSystem | null;
  viewCube?: { render(): void };
  holoScreenMatRef?: { current: THREE.ShaderMaterial | null };
  holoScreenMats?: THREE.ShaderMaterial[];
}

// Track To constraint temporaries (avoid per-frame allocations)
const _trackToPos = new THREE.Vector3();
const _trackToDir = new THREE.Vector3();
const _trackToQuat = new THREE.Quaternion();
const _trackToForward = new THREE.Vector3(0, 0, -1); // Blender convention

export function startAnimationLoop(deps: AnimationLoopDeps): Disposable {
  const {
    camera, renderer, cssRenderer, composer, scene,
    selection, componentRegistry, cardSystem,
    scrollText, camKeyframes,
    input,
    state,
    actors, resolveElementObject, cameraControls,
  } = deps;
  const { performanceActor, revelationActor } = actors;

  const clock = new THREE.Clock();
  let animationId: number;
  let frameCount = 0;
  let fpsAccum = 0;
  const fpsInterval = 1.0;

  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.033);

    // Revelation zone-based visibility
    revelationActor?.send({ type: 'UPDATE_REVELATION' });

    // Scroll text animation — save gizmo position+scale for title/subtitle before
    // scrollText.update() overwrites it, then restore after
    const gizmoActive = selection.isGizmoAttached() || selection.isCustomScaling() || selection.isGrabbing() || selection.isRotating() || selection.isMirroring() || selection.isBoxSelecting();
    const savedTextTransforms: Array<{ obj: THREE.Object3D; pos: THREE.Vector3; scale: number }> = [];
    if (gizmoActive) {
      for (const textId of ['title', 'subtitle'] as const) {
        if (selection.isSelected(textId)) {
          const obj = selection.getObjectById(textId);
          if (obj) savedTextTransforms.push({ obj, pos: obj.position.clone(), scale: obj.scale.x });
        }
      }
    }

    scrollText?.update(delta);

    // Restore saved text transforms
    for (const { obj, pos, scale } of savedTextTransforms) {
      obj.position.copy(pos);
      obj.scale.setScalar(scale);
    }

    // Apply element track transforms (override base positioning systems)
    for (const [id, transform] of Object.entries(state.cachedElementTransforms)) {
      if (!transform) continue;
      if ((selection.isGizmoAttached() || selection.isCustomScaling() || selection.isGrabbing() || selection.isRotating() || selection.isMirroring()) && selection.isSelected(id)) continue;

      if (id === 'card') {
        cardSystem.setPosition(transform.position.x, transform.position.y, transform.position.z);
        cardSystem.setRotation(transform.rotation.x, transform.rotation.y, transform.rotation.z);
        cardSystem.setScale(transform.scale);
        continue;
      }

      const cardInst = componentRegistry.get(id);
      if (cardInst?.type === 'card') {
        const cardExtra = cardInst.extra as CardExtra;
        cardExtra.system.setPosition(transform.position.x, transform.position.y, transform.position.z);
        cardExtra.system.setRotation(transform.rotation.x, transform.rotation.y, transform.rotation.z);
        cardExtra.system.setScale(transform.scale);
        continue;
      }

      const obj = resolveElementObject(id);
      if (!obj) continue;

      obj.position.set(transform.position.x, transform.position.y, transform.position.z);
      obj.scale.setScalar(transform.scale);
      if (id !== 'title' && id !== 'subtitle') {
        obj.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
      }
    }

    // Follow path constraint: lerp instance positions toward curve
    for (const [instanceId, fpState] of Object.entries(state.cachedFollowPathStates)) {
      const ci = componentRegistry.get(instanceId);
      if (!ci) continue;
      // Skip if gizmo is active on this instance
      if (gizmoActive && selection.isSelected(instanceId)) continue;
      const obj = ci.object3D;
      const inf = fpState.influence;
      obj.position.x += (fpState.position.x - obj.position.x) * inf;
      obj.position.y += (fpState.position.y - obj.position.y) * inf;
      obj.position.z += (fpState.position.z - obj.position.z) * inf;
      // Orient along tangent
      if (fpState.tangent) {
        const t = fpState.tangent;
        const len = Math.sqrt(t.x * t.x + t.y * t.y + t.z * t.z);
        if (len > 1e-6) {
          const target = new THREE.Vector3(
            obj.position.x + t.x / len,
            obj.position.y + t.y / len,
            obj.position.z + t.z / len,
          );
          const targetQ = new THREE.Quaternion();
          const lookMat = new THREE.Matrix4();
          lookMat.lookAt(obj.position, target, new THREE.Vector3(0, 1, 0));
          targetQ.setFromRotationMatrix(lookMat);
          obj.quaternion.slerp(targetQ, inf);
        }
      }
    }

    // Rotating spaceship parts (Y axis). Ring speeds live in state.ringSpeeds so the
    // DevPanel "Anneaux" section can adjust them (ring2 counter-rotates by default).
    const anneauxSpeed = state.ringSpeeds.ring1;
    const extSpeed = 0.06; // half of the default ring speed
    if (state.anneauxMesh) state.anneauxMesh.rotation.y += delta * anneauxSpeed;
    if (state.anneaux2Mesh) state.anneaux2Mesh.rotation.y += delta * state.ringSpeeds.ring2;
    if (state.extDetailsMesh) state.extDetailsMesh.rotation.y -= delta * extSpeed; // counter-rotation
    if (state.intDetailsMesh) state.intDetailsMesh.rotation.y += delta * extSpeed;
    if (state.intDetails001Mesh) state.intDetails001Mesh.rotation.y -= delta * extSpeed; // counter to intDetails

    // Card noise — subtle XYZ position oscillation on Card1/2/3 meshes
    state.cardNoise?.update(delta);
    state.downloadLogo?.update(delta);

    // Mini ship particle system
    if (state.particleSystem) {
      state.particleSystem.update(delta);
    }

    // Sun shader animation
    if (state.sunMat && state.sunMat.uniforms['uTime']) {
      state.sunMat.uniforms['uTime'].value += delta;
    }

    // Holo card screens animation
    for (const mat of state.holoCardMats) {
      if (mat.uniforms['uTime']) mat.uniforms['uTime'].value += delta;
    }

    // Holo wall scrolling logos
    for (const mat of state.holoWallMats) {
      if (mat.uniforms['uTime']) mat.uniforms['uTime'].value += delta;
    }

    // Scroll-driven camera animator (must be last writer on main camera).
    // Look-around souris : on alimente l'animator avec la position NDC (calée sur le canvas).
    // tick() AVANT la lecture : lissage doux de la position à la ré-entrée souris (anti à-coup).
    input.tick(delta);
    state.cameraAnimator?.setPointerNDC(input.mouseNDC.x, input.mouseNDC.y);
    state.cameraAnimator?.update(delta);

    // Live sentinel creature — after the animator so it consumes this frame's
    // scroll progress (path follow + wiggle + leader-follow + blink/iris/claws)
    state.sentinelCreature?.update(delta);

    // Onboarding B : décroissance scroll + ancrage de la bulle sur l'œil (après la pose créature).
    state.onboardingBridge?.update(delta);

    // Track To constraint: orient lights toward their target
    for (const [lightId, assignment] of Object.entries(state.trackToAssignments)) {
      const lightInst = componentRegistry.get(lightId);
      if (!lightInst) continue;
      if (gizmoActive && selection.isSelected(lightId)) continue;

      // Resolve target from SelectionSystem (supports both instances and global objects)
      const targetObj = selection.getObjectById(assignment.targetId);
      if (!targetObj) continue;

      const lightObj = lightInst.object3D;
      targetObj.getWorldPosition(_trackToPos);

      // Option: follow target position
      if (assignment.followPosition) {
        if (assignment.maintainDistance && assignment.initialDistance) {
          _trackToDir.subVectors(lightObj.position, _trackToPos).normalize();
          lightObj.position.copy(_trackToPos).addScaledVector(_trackToDir, assignment.initialDistance);
        } else {
          lightObj.position.copy(_trackToPos);
        }
      }

      // Orient toward target (-Z forward, Blender convention)
      _trackToDir.subVectors(_trackToPos, lightObj.position);
      if (_trackToDir.lengthSq() > 1e-8) {
        _trackToDir.normalize();
        _trackToQuat.setFromUnitVectors(_trackToForward, _trackToDir);
        lightObj.quaternion.copy(_trackToQuat);
      }

      // Sync Three.js target object (spot/directional)
      const extra = lightInst.extra as LightExtra;
      if (extra.target) {
        extra.target.position.copy(_trackToPos);
      }

      // Sync volumetric cone
      if (extra.volumetricCone && lightObj instanceof THREE.SpotLight) {
        extra.volumetricCone.syncWithLight(lightObj);
      }
    }

    // Billboard duplicated text instances (face camera like originals)
    for (const inst of componentRegistry.getByType('text')) {
      inst.object3D.quaternion.copy(camera.quaternion);
    }

    // Card opacity from computed.card (original card)
    cardSystem.setOpacity(state.cachedCardOpacity);
    // Instance lifecycle opacity (all duplicated instances)
    for (const [id, opacity] of Object.entries(state.cachedInstanceOpacities)) {
      componentRegistry.setOpacity(id, opacity);
    }

    // Camera keyframe animation (also updates ghostCamera for CameraHelper)
    camKeyframes?.update(delta);

    // CameraHelper (frustum de la ghostCamera) : MASQUÉ — il encombrait la vue en mode libre.
    // Le ghostCamera reste utilisé par le système de keyframes ; on ne dessine juste plus le frustum.
    // (Pour le réafficher : remettre `= state.freeCameraActive` + update() ci-dessous.)
    if (deps.cameraHelper) {
      deps.cameraHelper.visible = false;
    }

    // Free camera controls
    if (state.freeCameraActive && !selection.isCustomScaling()) {
      cameraControls.update(delta);
    }

    // Animations
    // Overmind INTÉGRÉ (OVM_ROOT) : bras en boucle + présentation périodique (possède son mixer).
    state.overmindPresentation?.update(delta);

    // Performance monitoring
    frameCount++;
    fpsAccum += delta;
    if (fpsAccum >= fpsInterval) {
      const currentFps = frameCount / fpsAccum;
      performanceActor?.send({ type: 'UPDATE_FPS', fps: currentFps });
      frameCount = 0;
      fpsAccum = 0;

      const perfMemory = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (perfMemory) {
        performanceActor?.send({
          type: 'UPDATE_MEMORY',
          used: perfMemory.usedJSHeapSize / (1024 * 1024),
          limit: perfMemory.jsHeapSizeLimit / (1024 * 1024),
        });
      }

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

    // Infinite grid follows camera
    const grid = scene.getObjectByName('infiniteGrid');
    if (grid instanceof InfiniteGrid) grid.followCamera(camera);

    // Update light helpers (sync positions before render)
    deps.lightHelpers?.update();

    // Update hologram screen shader time
    const elapsed = clock.elapsedTime;
    if (deps.holoScreenMats) {
      for (const mat of deps.holoScreenMats) {
        mat.uniforms.uTime.value = elapsed;
      }
    } else if (deps.holoScreenMatRef?.current) {
      deps.holoScreenMatRef.current.uniforms.uTime.value = elapsed;
    }

    // Render with bloom
    composer.render();

    // PIP viewport (after main render, before ViewCube)
    if (deps.pipViewport && state.pipVisible) {
      const pipW = state.pipSize === 'S' ? 200 : 400;
      const pipH = state.pipSize === 'S' ? 150 : 300;
      const TIMELINE_HEIGHT = 180;
      const pipX = window.innerWidth - pipW - 10;
      const pipY = TIMELINE_HEIGHT + 10; // WebGL coords: y=0 is bottom of screen
      deps.pipViewport.update();
      deps.pipViewport.render(renderer, pipX, pipY, pipW, pipH);
    }

    // ViewCube gizmo
    deps.viewCube?.render();

    // Render CSS3D overlay (card in 3D space)
    cssRenderer.render(scene, camera);
  }

  animate();

  return {
    dispose() {
      cancelAnimationFrame(animationId);
    },
  };
}
