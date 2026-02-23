import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { getDracoPath, getModelPath } from '../utils/dracoPath.ts';
import type { LoadedModel } from './types.ts';

// Permanent animation names (arms + eye rings)
const PERMANENT_ANIMS = [
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
      const cyanColor = new THREE.Color(0x00d0fa);
      [...irisMaterials, ...eyeRingsMaterials].forEach((mat) => {
        if ('emissive' in mat) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.emissive.copy(cyanColor);
          stdMat.emissiveIntensity = mat === irisMaterials[0] ? 1.2 : 1.0;
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
