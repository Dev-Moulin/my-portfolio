import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { getBasisPath, getDracoPath, getModelPath } from '../utils/dracoPath.ts';
import type { LoadedModel } from './types.ts';

// Permanent animation names (arms + eye rings)
export const PERMANENT_ANIMS = [
  'Bras_L1_Mouv', 'Bras_L2_Mouv', 'Bras_R1_Mouv', 'Bras_R2_Mouv',
  'Little_1_Mouv', 'Little_2_Mouv', 'Little_3_Mouv', 'Little_4_Mouv',
  'Little_5_Mouv', 'Little_6_Mouv', 'Little_7_Mouv', 'Little_8_Mouv',
  'Arm_Little_9Action', 'Little_10_Mouv', 'Little_11_Mouv',
  'Little_12_Mouv', 'Little_13_Mouv',
  'Anneaux_Eye_Ext_Action', 'Anneaux_Eye_Int_Action',
];

export interface MaterialRefs {
  iris: THREE.Material[];
  eyeRings: THREE.Material[];
  revealRings: THREE.Material[];
}

/** Glow cyan de l'iris Overmind (mesh "IRIS"). Source unique de vérité, réutilisée pour
 *  donner le MÊME look à l'iris de la sentinelle (cf. SceneRenderer eye-debug). */
export const OVERMIND_IRIS_GLOW = { color: 0x00d0fa, intensity: 1.2 } as const;

export interface RevealRefs {
  objects: THREE.Object3D[];
  model: THREE.Object3D;
}

export function loadModel(
  scene: THREE.Scene,
  basePath: string,
  onLoaded: (result: LoadedModel, materials: MaterialRefs, reveal: RevealRefs) => void,
  onError?: (error: unknown) => void,
): { dispose: () => void } {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(getDracoPath(basePath));
  loader.setDRACOLoader(dracoLoader);

  loader.load(
    getModelPath(basePath, 'V4.2_Overmind.glb'),
    (gltf) => {
      const model = gltf.scene;
      const irisMaterials: THREE.Material[] = [];
      const eyeRingsMaterials: THREE.Material[] = [];
      const revealRingsMaterials: THREE.Material[] = [];
      const revealObjectsSet = new Set<THREE.Object3D>();

      // Identify reveal ring objects (same names as OFC)
      model.traverse((child) => {
        if (child.name.match(/^AnneauxBloomArea_[1-5]$/)) {
          revealObjectsSet.add(child);
        } else if (child.name === 'Ring_Ext_SG1' || child.name === 'Ring_Int_SG1') {
          revealObjectsSet.add(child);
        }
      });

      // Collect materials for emissive setup
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (!mat) return;

        if (child.name === 'IRIS') {
          irisMaterials.push(mat);
        } else if (child.name === 'Anneaux_Eye_Ext' || child.name === 'Anneaux_Eye_Int') {
          eyeRingsMaterials.push(mat);
        }

        // Collect reveal ring materials (BloomArea, BigArm bloom materials)
        const matName = mat.name || '';
        if (matName === 'BloomArea' || matName === 'Bloom_BigArm_Sup' || matName === 'Bloom_BigArm_Inf') {
          if (!revealRingsMaterials.includes(mat)) {
            revealRingsMaterials.push(mat);
          }
        }
      });

      // Set emissive colors (cyan glow for bloom)
      const cyanColor = new THREE.Color(OVERMIND_IRIS_GLOW.color);
      [...irisMaterials, ...eyeRingsMaterials].forEach((mat) => {
        if ('emissive' in mat) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.emissive.copy(cyanColor);
          stdMat.emissiveIntensity = mat === irisMaterials[0] ? OVERMIND_IRIS_GLOW.intensity : 1.0;
          stdMat.needsUpdate = true;
        }
      });

      // Set emissive on reveal ring materials
      revealRingsMaterials.forEach((mat) => {
        if ('emissive' in mat) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.emissive.copy(cyanColor);
          stdMat.emissiveIntensity = 1.0;
          stdMat.needsUpdate = true;
        }
      });

      // Hide reveal ring objects at load time
      const revealObjectsArray = Array.from(revealObjectsSet);
      if (revealObjectsArray.length > 0) {
        revealObjectsArray.forEach((obj) => {
          obj.visible = false;
          obj.traverse((c) => { c.visible = false; });
        });
      }

      scene.add(model);

      // Setup animations
      const mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        if (PERMANENT_ANIMS.includes(clip.name)) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.setEffectiveTimeScale(0.6);
          action.setEffectiveWeight(1);
          action.play();
        }
      });

      onLoaded(
        { model, mixer },
        { iris: irisMaterials, eyeRings: eyeRingsMaterials, revealRings: revealRingsMaterials },
        { objects: revealObjectsArray, model },
      );
    },
    undefined,
    (error) => {
      console.error('[modelLoader] Error loading model:', error);
      onError?.(error);
    },
  );

  return { dispose: () => dracoLoader.dispose() };
}

/**
 * Load a static GLB model (geometry nodes + textures, no animations).
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
