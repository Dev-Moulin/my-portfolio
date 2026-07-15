import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { getBasisPath, getDracoPath, getModelPath } from '../utils/dracoPath.ts';

/** Glow cyan de l'iris Overmind (mesh "IRIS"). Source unique de vérité, réutilisée pour
 *  donner le MÊME look à l'iris de la sentinelle (cf. SceneRenderer eye-debug). */
export const OVERMIND_IRIS_GLOW = { color: 0x00d0fa, intensity: 1.2 } as const;

/**
 * Load a GLB model (Draco geometry + KTX2 textures) and add it to the scene.
 */
export function loadSecondaryModel(
  scene: THREE.Scene,
  basePath: string,
  filename: string,
  renderer: THREE.WebGLRenderer,
  onLoaded: (model: THREE.Object3D, animations: THREE.AnimationClip[]) => void,
  onError?: (error: unknown) => void,
): { dispose: () => void } {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(getDracoPath(basePath));
  loader.setDRACOLoader(dracoLoader);

  // Textures KTX2/BasisU (V2.8.1+). detectSupport(renderer) OBLIGATOIRE : sans lui, le loader
  // ne connaît pas le format GPU cible et les textures ne sont pas transcodées.
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(getBasisPath(basePath));
  ktx2Loader.detectSupport(renderer);
  loader.setKTX2Loader(ktx2Loader);

  loader.load(
    getModelPath(basePath, filename),
    (gltf) => {
      const model = gltf.scene;
      scene.add(model);
      onLoaded(model, gltf.animations);
    },
    undefined,
    (error) => {
      console.error(`[modelLoader] Error loading ${filename}:`, error);
      onError?.(error);
    },
  );

  return {
    dispose: () => {
      dracoLoader.dispose();
      ktx2Loader.dispose();
    },
  };
}
