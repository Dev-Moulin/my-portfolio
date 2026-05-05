import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { computeCameraState } from '../machines/timelineMachine.ts';
import type { SelectionSystem } from './selectionSystem.ts';
import type { ScrollTextSystem } from './scrollText.ts';
import type { CardSystem } from './cardSystem.ts';
import type { ComponentRegistry } from './componentRegistry.ts';
import type { SceneActors, SceneMutableState } from './sceneContext.ts';

export interface CameraHelpersResult {
  cameraControls: CameraControls;
  toggleCameraMode: () => void;
  captureKeyframe: () => void;
  insertInterpolatedKeyframe: () => void;
  captureElementKeyframe: () => void;
  resolveElementObject: (id: string) => THREE.Object3D | null;
  ghostCamera: THREE.PerspectiveCamera;
  cameraHelper: THREE.CameraHelper;
  dispose: () => void;
}

export function setupCameraHelpers(
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  selection: SelectionSystem,
  scrollText: ScrollTextSystem | null,
  cardSystem: CardSystem,
  componentRegistry: ComponentRegistry,
  actors: SceneActors,
  state: SceneMutableState,
): CameraHelpersResult {
  const { timelineActor, sceneActor } = actors;

  const cameraControls = new CameraControls(camera, renderer.domElement);
  cameraControls.enabled = false; // start in scroll-driven mode

  // Ghost camera — receives keyframe animation in free mode so CameraHelper shows the frustum
  const ghostCamera = new THREE.PerspectiveCamera(
    camera.fov, camera.aspect, camera.near, camera.far,
  );
  ghostCamera.position.copy(camera.position);
  ghostCamera.quaternion.copy(camera.quaternion);

  // CameraHelper — wireframe frustum visualization of the animated camera
  const cameraHelper = new THREE.CameraHelper(ghostCamera);
  cameraHelper.visible = false;
  scene.add(cameraHelper);

  // Sync XState viewMode → mutable state cache (for perf in animation loop)
  const viewModeSub = sceneActor?.subscribe((snap) => {
    const isFree = snap.context.viewMode === 'free';
    if (state.freeCameraActive !== isFree) {
      state.freeCameraActive = isFree;
      state.cameraAnimator?.setFreeMode(isFree);
    }
  });

  // Blender-style mouse buttons
  cameraControls.mouseButtons.left = CameraControls.ACTION.NONE;     // LMB = sélection (SelectionSystem)
  cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;    // RMB reserved
  cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE; // MMB = orbit

  // Zoom intelligent
  cameraControls.dollyToCursor = true;   // zoom vers le curseur
  cameraControls.infinityDolly = true;   // pas de blocage au point focal

  // Turntable — axe Z fixe (pas de tête en bas)
  cameraControls.minPolarAngle = 0.05;
  cameraControls.maxPolarAngle = Math.PI - 0.05;

  function toggleCameraMode() {
    // Toggle via XState (source of truth) — subscribe callback syncs state.freeCameraActive
    sceneActor?.send({ type: 'TOGGLE_VIEW_MODE' });
    const isFree = sceneActor?.getSnapshot()?.context.viewMode === 'free';
    state.freeCameraActive = isFree;
    cameraControls.enabled = isFree;

    if (isFree) {
      // Snapshot current camera into ghostCamera before entering free mode
      ghostCamera.position.copy(camera.position);
      ghostCamera.quaternion.copy(camera.quaternion);
      ghostCamera.fov = camera.fov;
      ghostCamera.near = camera.near;
      ghostCamera.far = camera.far;
      ghostCamera.updateProjectionMatrix();

      cameraControls.setLookAt(
        camera.position.x, camera.position.y, camera.position.z,
        camera.position.x + camera.getWorldDirection(new THREE.Vector3()).x * 10,
        camera.position.y + camera.getWorldDirection(new THREE.Vector3()).y * 10,
        camera.position.z + camera.getWorldDirection(new THREE.Vector3()).z * 10,
        false,
      );
      timelineActor?.send({ type: 'SET_CAMERA_ENABLED', enabled: false });
      cameraHelper.visible = true;
    } else {
      timelineActor?.send({ type: 'SET_CAMERA_ENABLED', enabled: true });
      cameraHelper.visible = false;
    }

    window.dispatchEvent(new CustomEvent('overmind:camera-mode', { detail: isFree ? 'free' : 'scroll' }));
  }

  function captureKeyframe() {
    if (!state.freeCameraActive || !timelineActor) return;

    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    cameraControls.getPosition(pos);
    cameraControls.getTarget(target);

    const frame = timelineActor.getSnapshot().context.currentFrame;

    timelineActor.send({
      type: 'ADD_KEYFRAME',
      keyframe: {
        at: Math.round(frame),
        posX: Math.round(pos.x * 100) / 100,
        posY: Math.round(pos.y * 100) / 100,
        posZ: Math.round(pos.z * 100) / 100,
        lookAtX: Math.round(target.x * 100) / 100,
        lookAtY: Math.round(target.y * 100) / 100,
        lookAtZ: Math.round(target.z * 100) / 100,
        fov: Math.round(camera.fov * 10) / 10,
        easing: 'smoothstep' as const,
      },
    });

    window.dispatchEvent(new CustomEvent('overmind:keyframe-captured', { detail: frame }));
  }

  function insertInterpolatedKeyframe() {
    if (!timelineActor) return;
    const ctx = timelineActor.getSnapshot().context;
    const frame = ctx.currentFrame;
    const computed = computeCameraState(ctx.cameraKeyframes, frame);
    if (!computed) return;

    timelineActor.send({
      type: 'ADD_KEYFRAME',
      keyframe: {
        at: Math.round(frame),
        posX: Math.round(computed.posX * 100) / 100,
        posY: Math.round(computed.posY * 100) / 100,
        posZ: Math.round(computed.posZ * 100) / 100,
        lookAtX: Math.round(computed.lookAtX * 100) / 100,
        lookAtY: Math.round(computed.lookAtY * 100) / 100,
        lookAtZ: Math.round(computed.lookAtZ * 100) / 100,
        fov: Math.round(computed.fov * 10) / 10,
        easing: 'smoothstep' as const,
      },
    });

    window.dispatchEvent(new CustomEvent('overmind:keyframe-captured', { detail: frame }));
  }

  function captureElementKeyframe() {
    if (!timelineActor) return;
    const ids = selection.getSelectedIds();
    if (ids.length === 0) return;

    const frame = timelineActor.getSnapshot().context.currentFrame;
    for (const id of ids) {
      const obj = selection.getObjectById(id);
      if (!obj) continue;
      timelineActor.send({
        type: 'ADD_ELEMENT_KF',
        elementId: id,
        keyframe: {
          frame: Math.round(frame),
          position: {
            x: Math.round(obj.position.x * 100) / 100,
            y: Math.round(obj.position.y * 100) / 100,
            z: Math.round(obj.position.z * 100) / 100,
          },
          rotation: {
            x: Math.round(obj.rotation.x * 1000) / 1000,
            y: Math.round(obj.rotation.y * 1000) / 1000,
            z: Math.round(obj.rotation.z * 1000) / 1000,
          },
          scale: Math.round(obj.scale.x * 100) / 100,
          easing: 'smoothstep' as const,
        },
      });
    }

    window.dispatchEvent(new CustomEvent('overmind:keyframe-captured', { detail: frame }));
  }

  function resolveElementObject(id: string): THREE.Object3D | null {
    if (id === 'title') return scrollText?.getTitleMesh() ?? null;
    if (id === 'subtitle') return scrollText?.getSubtitleMesh() ?? null;
    if (id === 'card') return cardSystem.getProxyMesh();
    return componentRegistry.resolveObject(id);
  }

  function dispose() {
    viewModeSub?.unsubscribe();
    scene.remove(cameraHelper);
    cameraHelper.dispose();
  }

  return {
    cameraControls, toggleCameraMode, captureKeyframe,
    insertInterpolatedKeyframe, captureElementKeyframe, resolveElementObject,
    ghostCamera, cameraHelper, dispose,
  };
}
