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
  /** Second ring ("Anneaux" node) — counter-rotates against anneauxMesh */
  anneaux2Mesh: THREE.Object3D | null;
  /** Ring spin speeds (rad/s), adjustable from the DevPanel "Anneaux" section */
  ringSpeeds: { ring1: number; ring2: number };
  extDetailsMesh: THREE.Object3D | null;
  intDetailsMesh: THREE.Object3D | null;
  intDetails001Mesh: THREE.Object3D | null;
  // Overmind INTÉGRÉ au vaisseau (OVM_ROOT) : bras en boucle (repos) + présentation périodique
  // d'un objet (anneaux / BTC / ETH). Possède son propre AnimationMixer. Remplace l'ancien V4.2.
  overmindPresentation: import('./overmindPresentationSystem.ts').OvermindPresentationSystem | null;
  // Mini ship particle system — circuit fermé (courbe Bézier) + zones de masquage aux
  // extrémités (fondu scale→0 pour cacher les demi-tours).
  particleSystem: {
    update(delta: number): void;
    dispose(): void;
    setSpeed(speed: number): void;
    setTargetCount(count: number): void;
    setShipScale(scale: number): void;
    setFadeZone(start: number, end: number): void;
    setMotion(m: {
      spread?: number; speedVar?: number; laneAmp?: number;
      swayAmp?: number; swayFreq?: number; rollFraction?: number; bank?: number;
    }): void;
    setCircuits(circuits: number, angleDeg: number): void;
    setPathsVisible(visible: boolean): void;
  } | null;
  // Sun shader material (animated)
  sunMat: THREE.ShaderMaterial | null;
  // Holo card screen materials (animated uTime)
  holoCardMats: THREE.ShaderMaterial[];
  // Holo card entries (mesh + material + cardIdx) — used to rebuild textures on language change
  holoCardEntries: import('./holoScreenShader.ts').HoloCardEntry[];
  // Current card language (FR/EN) — driven by i18n via the overmind:language-change event
  cardLang: import('./holoScreenShader.ts').HoloLang;
  // Holo wall scrolling logos materials (animated uTime)
  holoWallMats: THREE.ShaderMaterial[];
  // Scroll-driven camera animator
  cameraAnimator: import('./scrollCameraAnimator.ts').ScrollCameraAnimator | null;
  // Live sentinel creature (wiggle + SH shader + path follow, synced to scroll)
  sentinelCreature: import('../sentinelCreature/SentinelCreatureSystem.ts').SentinelCreatureSystem | null;
  // Onboarding B (présentation guidée à l'arrivée AB) : machine XState + détour scroll + bulle
  onboardingBridge: import('./onboardingBridge.ts').OnboardingBridge | null;
  // Card click + reading mode raycaster
  cardClickSystem: { dispose(): void } | null;
  // Free-look drag (V1 desktop) : détacheur des listeners du geste (freeLookDrag.ts)
  freeLookDetach: (() => void) | null;
  // Card noise (subtle position oscillation on Card1/2/3 meshes)
  cardNoise: { update(delta: number): void; dispose(): void } | null;
  // Logo download animé (Card1) — anim rejouée en JS (non exportée dans le GLB)
  downloadLogo: { update(delta: number): void; dispose(): void } | null;
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
