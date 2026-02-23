import { setup, assign } from 'xstate';
import * as THREE from 'three';

export interface TriggerZone {
  position: { x: number; y: number; z: number };
  radius: number;
  height: number;
}

export interface RingInfo {
  name: string;
  object: THREE.Object3D;
  position: THREE.Vector3;
  visible: boolean;
  distance: number;
  isInZone: boolean;
}

interface RevelationContext {
  triggerZone: TriggerZone;
  rings: THREE.Object3D[];
  ringInfos: RingInfo[];
  modelRef: THREE.Object3D | null;
  forceShowAll: boolean;
  isAnimating: boolean;
  showZoneHelper: boolean;
  moveSpeed: number;
  scaleSpeed: number;
  tempVec: THREE.Vector3;
  tempZone: THREE.Vector3;
}

type RevelationEvent =
  | { type: 'SET_RINGS'; rings: THREE.Object3D[] }
  | { type: 'SET_MODEL_REFERENCE'; model: THREE.Object3D }
  | { type: 'UPDATE_REVELATION' }
  | { type: 'TOGGLE_FORCE_SHOW_ALL' }
  | { type: 'SET_FORCE_SHOW_ALL'; force: boolean }
  | { type: 'TOGGLE_ZONE_HELPER'; visible: boolean }
  | { type: 'START_RING_ANIMATION' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'MOVE_ZONE'; direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward' }
  | { type: 'SCALE_ZONE'; direction: 'increase' | 'decrease' }
  | { type: 'UPDATE_ZONE_POSITION'; position: { x: number; y: number; z: number } }
  | { type: 'UPDATE_ZONE_RADIUS'; radius: number }
  | { type: 'RESET_ZONE' };

const DEFAULT_ZONE: TriggerZone = {
  position: { x: 3.3, y: 3.4, z: 1.9 },
  radius: 1.3,
  height: 0.6
};

export const revelationMachine = setup({
  types: {
    context: {} as RevelationContext,
    events: {} as RevelationEvent
  },
  actions: {
    setRings: assign({
      rings: ({ event }) => {
        if (event.type === 'SET_RINGS') return event.rings;
        return [];
      }
    }),
    setModelReference: assign({
      modelRef: ({ event }) => {
        if (event.type === 'SET_MODEL_REFERENCE') return event.model;
        return null;
      }
    }),
    updateRevelation: assign({
      ringInfos: ({ context }) => {
        const { rings, triggerZone, modelRef, forceShowAll, tempVec, tempZone } = context;
        if (rings.length === 0) return [];

        return rings.map(ring => {
          ring.getWorldPosition(tempVec);

          let zonePosition = new THREE.Vector3(
            triggerZone.position.x,
            triggerZone.position.y,
            triggerZone.position.z
          );
          if (modelRef) {
            tempZone.copy(zonePosition);
            tempZone.applyMatrix4(modelRef.matrixWorld);
            zonePosition = tempZone.clone();
          }

          const distance = tempVec.distanceTo(zonePosition);
          const isInZone = distance <= triggerZone.radius &&
            Math.abs(tempVec.y - zonePosition.y) <= triggerZone.height;

          const shouldShow = forceShowAll || !isInZone;
          ring.visible = shouldShow;
          ring.traverse((child) => { child.visible = shouldShow; });

          return {
            name: ring.name,
            object: ring,
            position: tempVec.clone(),
            visible: shouldShow,
            distance,
            isInZone
          };
        });
      }
    }),
    toggleForceShowAll: assign({
      forceShowAll: ({ context }) => !context.forceShowAll
    }),
    setForceShowAll: assign({
      forceShowAll: ({ event }) => {
        if (event.type === 'SET_FORCE_SHOW_ALL') return event.force;
        return false;
      }
    }),
    startAnimation: assign({ isAnimating: true }),
    completeAnimation: assign({ isAnimating: false }),
    moveZone: assign({
      triggerZone: ({ context, event }) => {
        if (event.type !== 'MOVE_ZONE') return context.triggerZone;
        const { position } = context.triggerZone;
        const { moveSpeed } = context;
        const newPosition = { ...position };
        switch (event.direction) {
          case 'forward':  newPosition.z -= moveSpeed; break;
          case 'backward': newPosition.z += moveSpeed; break;
          case 'left':     newPosition.x -= moveSpeed; break;
          case 'right':    newPosition.x += moveSpeed; break;
          case 'up':       newPosition.y += moveSpeed; break;
          case 'down':     newPosition.y -= moveSpeed; break;
        }
        return { ...context.triggerZone, position: newPosition };
      }
    }),
    scaleZone: assign({
      triggerZone: ({ context, event }) => {
        if (event.type !== 'SCALE_ZONE') return context.triggerZone;
        const { scaleSpeed } = context;
        const newRadius = event.direction === 'increase'
          ? context.triggerZone.radius + scaleSpeed
          : Math.max(0.5, context.triggerZone.radius - scaleSpeed);
        return { ...context.triggerZone, radius: newRadius };
      }
    }),
    resetZone: assign({ triggerZone: () => ({ ...DEFAULT_ZONE }) }),
    toggleZoneHelper: assign({
      showZoneHelper: ({ event }) => {
        if (event.type === 'TOGGLE_ZONE_HELPER') return event.visible;
        return false;
      }
    })
  }
}).createMachine({
  id: 'revelation',
  initial: 'idle',
  context: {
    triggerZone: { ...DEFAULT_ZONE },
    rings: [],
    ringInfos: [],
    modelRef: null,
    forceShowAll: false,
    isAnimating: false,
    showZoneHelper: false,
    moveSpeed: 0.5,
    scaleSpeed: 0.1,
    tempVec: new THREE.Vector3(),
    tempZone: new THREE.Vector3()
  },
  states: {
    idle: {
      on: {
        SET_RINGS: { actions: 'setRings' },
        SET_MODEL_REFERENCE: { actions: 'setModelReference' },
        UPDATE_REVELATION: { actions: 'updateRevelation' },
        TOGGLE_FORCE_SHOW_ALL: { actions: ['toggleForceShowAll', 'updateRevelation'] },
        SET_FORCE_SHOW_ALL: { actions: ['setForceShowAll', 'updateRevelation'] },
        TOGGLE_ZONE_HELPER: { actions: 'toggleZoneHelper' },
        START_RING_ANIMATION: { target: 'animating', actions: 'startAnimation' },
        MOVE_ZONE: { actions: ['moveZone', 'updateRevelation'] },
        SCALE_ZONE: { actions: ['scaleZone', 'updateRevelation'] },
        RESET_ZONE: { actions: ['resetZone', 'updateRevelation'] }
      }
    },
    animating: {
      on: {
        ANIMATION_COMPLETE: { target: 'idle', actions: 'completeAnimation' }
      }
    }
  }
});
