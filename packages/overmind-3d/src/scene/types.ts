import type * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

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
  cssRenderer: CSS3DRenderer;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  outlinePass: OutlinePass;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  pointLight: THREE.PointLight;
}

export interface LoadedModel {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
}
