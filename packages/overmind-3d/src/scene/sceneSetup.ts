import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { SceneSetupResult } from './types.ts';

export function createScene(container: HTMLDivElement): SceneSetupResult {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Scene — fond noir opaque (comme OFC)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 12);
  camera.lookAt(0, 1, 0);

  // Renderer — pas d'alpha, rendu opaque (comme OFC)
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Lights — valeurs idle_disconnected
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(1, 2, 3);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0x00ffff, 2.0, 100);
  pointLight.position.set(0, 2, 0);
  scene.add(pointLight);

  // Post-processing — bloom (valeurs idle_disconnected)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomResolutionScale = window.devicePixelRatio > 1 ? 0.5 : 1.0;
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width * bloomResolutionScale, height * bloomResolutionScale),
    1.0,   // strength
    0.07,  // radius
    0.5,   // threshold
  );
  composer.addPass(bloomPass);

  return { scene, camera, renderer, composer, bloomPass, ambientLight, directionalLight, pointLight };
}
