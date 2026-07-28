import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { SceneSetupResult } from './types.ts';
import { getQualityProfile } from './qualityProfile.ts';

export function createScene(container: HTMLDivElement): SceneSetupResult {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const quality = getQualityProfile();

  // Scene — fond noir opaque (comme OFC)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 12);
  camera.lookAt(0, 1, 0);

  // Renderer — pas d'alpha, rendu opaque (comme OFC)
  const renderer = new THREE.WebGLRenderer({
    antialias: quality.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // CSS3D overlay renderer (for HTML elements in 3D space)
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(width, height);
  cssRenderer.domElement.style.position = 'absolute';
  cssRenderer.domElement.style.top = '0';
  cssRenderer.domElement.style.left = '0';
  cssRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(cssRenderer.domElement);

  // Ambient light (global) — intensité pilotée par lightsMachine (défaut 0). On démarre à 0
  // pour éviter un flash avant le syncAmbient de l'INIT.
  const ambientLight = new THREE.AmbientLight(0xffffff, 0);
  scene.add(ambientLight);

  // Post-processing — bloom global (valeurs idle_disconnected)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomResolutionScale = quality.bloomResolutionScale;
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width * bloomResolutionScale, height * bloomResolutionScale),
    1.0,   // strength
    0.07,  // radius
    0.5,   // threshold
  );
  composer.addPass(bloomPass);

  // Selection outline (orange, Blender-style) — after bloom so outline is clean.
  // Toujours CRÉÉ (SelectionSystem garde sa référence) mais ajouté au composer seulement
  // en tier high : c'est un outil d'atelier, en pleine résolution — inutile et coûteux
  // pour un visiteur tactile. Non ajouté = coût zéro par frame.
  const outlinePass = new OutlinePass(
    new THREE.Vector2(width, height), scene, camera,
  );
  outlinePass.visibleEdgeColor.set(0xFF9800);
  outlinePass.hiddenEdgeColor.set(0xFF9800);
  outlinePass.edgeStrength = 3;
  outlinePass.edgeGlow = 0;
  outlinePass.edgeThickness = 1;
  if (quality.outlinePass) composer.addPass(outlinePass);

  return { scene, camera, renderer, cssRenderer, composer, bloomPass, outlinePass, ambientLight };
}
