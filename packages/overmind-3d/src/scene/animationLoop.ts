import * as THREE from 'three';
import type * as YUKA from 'yuka';
import type CameraControls from 'camera-controls';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ComponentRegistry } from './componentRegistry.ts';
import type { NeonExtra } from './descriptors/neonDescriptor.ts';
import type { CardExtra } from './descriptors/cardDescriptor.ts';
import type { CardSystem } from './cardSystem.ts';
import type { NeonBandsSystem } from './neonBands.ts';
import type { ScrollTextSystem } from './scrollText.ts';
import type { CameraKeyframeSystem } from './cameraKeyframes.ts';
import type { InputTracker } from './inputTracker.ts';
import type { GazeSystem } from './gazeSystem.ts';
import type { SoftBoundaryBehavior } from '../systems/SoftBoundaryBehavior.ts';
import type { MouseRepulsionBehavior } from '../systems/MouseRepulsionBehavior.ts';
import type { WanderBehaviorXY } from '../systems/WanderBehaviorXY.ts';
import type { SceneActors, SceneMutableState, Disposable } from './sceneContext.ts';
import type { ModelSettings } from './types.ts';

export interface AnimationLoopDeps {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cssRenderer: CSS3DRenderer;
  composer: EffectComposer;
  scene: THREE.Scene;
  selection: SelectionSystem;
  componentRegistry: ComponentRegistry;
  cardSystem: CardSystem;
  neonBands: NeonBandsSystem | null;
  scrollText: ScrollTextSystem | null;
  camKeyframes: CameraKeyframeSystem | null;
  input: InputTracker;
  gaze: GazeSystem;
  entityManager: YUKA.EntityManager;
  vehicle: YUKA.Vehicle;
  boundaryBehavior: SoftBoundaryBehavior;
  mouseRepulsion: MouseRepulsionBehavior;
  wanderBehavior: WanderBehaviorXY;
  state: SceneMutableState;
  modelRef: React.MutableRefObject<THREE.Object3D | null>;
  mixerRef: React.MutableRefObject<THREE.AnimationMixer | null>;
  modelSettingsRef: { current: ModelSettings };
  actors: SceneActors;
  resolveElementObject: (id: string) => THREE.Object3D | null;
  cameraControls: CameraControls;
  initialModelZ: number;
}

export function startAnimationLoop(deps: AnimationLoopDeps): Disposable {
  const {
    camera, renderer, cssRenderer, composer, scene,
    selection, componentRegistry, cardSystem,
    neonBands, scrollText, camKeyframes,
    input, gaze, entityManager, vehicle, boundaryBehavior, mouseRepulsion, wanderBehavior,
    state, modelRef, mixerRef, modelSettingsRef,
    actors, resolveElementObject, cameraControls, initialModelZ,
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

    // Update mouse world position for repulsion
    const vFov = camera.fov * Math.PI / 180;
    const frustumHalfH = Math.tan(vFov / 2) * camera.position.z;
    const frustumHalfW = frustumHalfH * camera.aspect;
    mouseRepulsion.setMousePosition(
      input.mouseNDC.x * frustumHalfW,
      input.mouseNDC.y * frustumHalfH,
    );

    // Eye path following: scale down behaviors before Yuka update
    const pathBlend = state.cachedEyePathBlend;
    const savedWanderActive = wanderBehavior.active;
    const savedBoundaryW = boundaryBehavior.weight;
    const savedRepulsionW = mouseRepulsion.weight;

    if (pathBlend > 0) {
      wanderBehavior.active = pathBlend < 0.95;
      boundaryBehavior.weight = savedBoundaryW * (1 - pathBlend);
      mouseRepulsion.weight = savedRepulsionW * state.cachedEyePathRepulsionScale;
    }

    // Yuka steering update
    entityManager.update(delta);

    // Restore behavior weights immediately (so steeringSub keeps control)
    if (pathBlend > 0) {
      boundaryBehavior.weight = savedBoundaryW;
      mouseRepulsion.weight = savedRepulsionW;
      wanderBehavior.active = savedWanderActive;
    }

    // Post-Yuka safety: soft bounce at boundaries
    const b = boundaryBehavior.bounds;
    const vp = vehicle.position;
    const vel = vehicle.velocity;

    if (vp.x < b.xMin) { vp.x = b.xMin; vel.x = Math.abs(vel.x) * state.wallBounceFactor; }
    else if (vp.x > b.xMax) { vp.x = b.xMax; vel.x = -Math.abs(vel.x) * state.wallBounceFactor; }
    if (vp.y < b.yMin) { vp.y = b.yMin; vel.y = Math.abs(vel.y) * state.wallBounceFactor; }
    else if (vp.y > b.yMax) { vp.y = b.yMax; vel.y = -Math.abs(vel.y) * state.wallBounceFactor; }

    if (b.zMin !== undefined && b.zMax !== undefined) {
      if (vp.z < b.zMin) { vp.z = b.zMin; vel.z = Math.abs(vel.z) * state.wallBounceFactor; }
      else if (vp.z > b.zMax) { vp.z = b.zMax; vel.z = -Math.abs(vel.z) * state.wallBounceFactor; }
    } else {
      vel.z = 0;
      vp.z = initialModelZ;
    }

    // Eye path following: blend vehicle position toward curve
    if (pathBlend > 0 && state.cachedEyePathPosition) {
      const cp = state.cachedEyePathPosition;
      vp.x += (cp.x - vp.x) * pathBlend;
      vp.y += (cp.y - vp.y) * pathBlend;
      vp.z += (cp.z - vp.z) * pathBlend;

      // Dampen velocity when mostly on curve to prevent handoff jerk
      if (pathBlend > 0.8) {
        const damp = 1 - (pathBlend - 0.8) * 5; // 0.8→1.0 maps to 1.0→0.0
        vel.x *= damp;
        vel.y *= damp;
        vel.z *= damp;
      }
    }

    // Input tracking
    const ms = modelSettingsRef.current;
    const lerpFactor = input.isActive ? ms.mouseSensitivity : ms.mouseReturnSpeed;
    input.update(delta, lerpFactor);

    // Gaze system (blend mouse <-> autonomous)
    gaze.update(delta, input.lastMoveTimestamp, vehicle, true);

    // Apply to model (skip when gizmo is attached to avoid Yuka overriding gizmo position)
    const gizmoOnModel = (selection.isGizmoAttached() || selection.isCustomScaling() || selection.isGrabbing() || selection.isRotating() || selection.isMirroring() || selection.isBoxSelecting()) && selection.isSelected('model');
    if (modelRef.current && !gizmoOnModel) {
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
    for (const inst of componentRegistry.getByType('neon')) {
      (inst.extra as NeonExtra).system.update(delta);
    }

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

    // Camera keyframe animation
    camKeyframes?.update(delta);

    // Free camera controls
    if (state.freeCameraActive && !selection.isCustomScaling()) {
      cameraControls.update(delta);
    }

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

    // Render with bloom
    composer.render();

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
