import type * as THREE from 'three';
import type { ActorRefFrom } from 'xstate';
import type { bloomMachine } from '../machines/bloomMachine.ts';
import type { lightsMachine } from '../machines/lightsMachine.ts';
import type { materialMachine } from '../machines/materialMachine.ts';
import type { modelMachine } from '../machines/modelMachine.ts';
import type { pbrMachine } from '../machines/pbrMachine.ts';
import type { sceneMachine } from '../machines/sceneMachine.ts';
import type { performanceMonitor } from '../machines/performanceMachine.ts';
import type { revelationMachine } from '../machines/revelationMachine.ts';
import type { steeringMachine } from '../machines/steeringMachine.ts';
import type { timelineMachine } from '../machines/timelineMachine.ts';
import type { selectionMachine } from '../machines/selectionMachine.ts';
import type { interactionModeMachine } from '../machines/interactionModeMachine.ts';
import type { ComputedElementTransform, ComputedFollowPathState } from '../machines/timelineMachine.ts';

export type { ComputedElementTransform };

/** All XState actors (nullable — may not be started yet) */
export interface SceneActors {
  bloomActor: ActorRefFrom<typeof bloomMachine> | null | undefined;
  lightsActor: ActorRefFrom<typeof lightsMachine> | null | undefined;
  materialActor: ActorRefFrom<typeof materialMachine> | null | undefined;
  modelActor: ActorRefFrom<typeof modelMachine> | null | undefined;
  pbrActor: ActorRefFrom<typeof pbrMachine> | null | undefined;
  sceneActor: ActorRefFrom<typeof sceneMachine> | null | undefined;
  performanceActor: ActorRefFrom<typeof performanceMonitor> | null | undefined;
  revelationActor: ActorRefFrom<typeof revelationMachine> | null | undefined;
  steeringActor: ActorRefFrom<typeof steeringMachine> | null | undefined;
  timelineActor: ActorRefFrom<typeof timelineMachine> | null | undefined;
  selectionActor: ActorRefFrom<typeof selectionMachine> | null | undefined;
  interactionModeActor: ActorRefFrom<typeof interactionModeMachine> | null | undefined;
}

/** Mutable shared state (replaces `let` closure variables) */
export interface SceneMutableState {
  freeCameraActive: boolean;
  cachedElementTransforms: Record<string, ComputedElementTransform | null>;
  cachedCardOpacity: number;
  cachedInstanceOpacities: Record<string, number>;
  steeringRanges: { xRange: number; yDown: number; yUp: number; zBack: number; zFront: number };
  wallBounceFactor: number;
  // Eye path following
  cachedEyePathPosition: { x: number; y: number; z: number } | null;
  cachedEyePathBlend: number;
  cachedEyePathRepulsionScale: number;
  cachedEyePathTangent: { x: number; y: number; z: number } | null;
  // Follow path states
  cachedFollowPathStates: Record<string, ComputedFollowPathState>;
  // PIP viewport
  pipVisible: boolean;
  pipSize: 'S' | 'L';
  // Rotating meshes
  anneauxMesh: THREE.Object3D | null;
  extDetailsMesh: THREE.Object3D | null;
  intDetailsMesh: THREE.Object3D | null;
  intDetails001Mesh: THREE.Object3D | null;
  // Mini ship particle system
  particleSystem: { update(delta: number): void; dispose(): void } | null;
  // Sun shader material (animated)
  sunMat: THREE.ShaderMaterial | null;
  // Holo card screen materials (animated uTime)
  holoCardMats: THREE.ShaderMaterial[];
  // Holo wall scrolling logos materials (animated uTime)
  holoWallMats: THREE.ShaderMaterial[];
  // Scroll-driven camera animator
  cameraAnimator: import('./scrollCameraAnimator.ts').ScrollCameraAnimator | null;
  // Card click + reading mode raycaster
  cardClickSystem: { dispose(): void } | null;
  // Card noise (subtle position oscillation on Card1/2/3 meshes)
  cardNoise: { update(delta: number): void; dispose(): void } | null;
  // Track To constraint assignments (lightId → config)
  trackToAssignments: Record<string, {
    targetId: string;
    maintainDistance: boolean;
    followPosition: boolean;
    initialDistance?: number;
  }>;
}

/** Common cleanup interface */
export interface Disposable {
  dispose: () => void;
}
