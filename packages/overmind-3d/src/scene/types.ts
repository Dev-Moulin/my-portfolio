import type * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface ModelSettings {
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
  baseRotationY: number;
  mouseSensitivity: number;
  mouseReturnSpeed: number;
  mouseDeadZone: number;
  mouseMaxRotY: number;
  mouseMaxRotX: number;
  mouseInactiveMs: number;
}

export interface SceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  pointLight: THREE.PointLight;
}

export interface LoadedModel {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
}
