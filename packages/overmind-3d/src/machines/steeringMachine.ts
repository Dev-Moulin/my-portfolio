import { setup, assign } from 'xstate';

export interface SteeringContext {
  // Vehicle
  maxSpeed: number;
  maxForce: number;
  mass: number;

  // Wander
  wanderRadius: number;
  wanderDistance: number;
  wanderJitter: number;
  wanderZFactor: number;  // intensité du mouvement Z (0 = pas de Z, 1 = plein)

  // Boundaries
  boundaryXRange: number;
  boundaryYDown: number;
  boundaryYUp: number;
  boundaryZBack: number;   // profondeur (loin de la re ce roite de l'ecrande  → paraît plus petit)
  boundaryZFront: number;  // proximité (vers la caméra → paraît plus grand)
  boundaryMargin: number;
  boundaryStrength: number;
  boundaryWeight: number;

  // Mouse repulsion
  repulsionBaseMinDist: number;
  repulsionAmplitude: number;
  repulsionSpeed: number;
  repulsionStrength: number;
  repulsionWeight: number;

  // Wall bounce (hard clamp fallback)
  wallBounceFactor: number;
}

export type SteeringEvents =
  | { type: 'SET_MAX_SPEED'; value: number }
  | { type: 'SET_MAX_FORCE'; value: number }
  | { type: 'SET_MASS'; value: number }
  | { type: 'SET_WANDER_RADIUS'; value: number }
  | { type: 'SET_WANDER_DISTANCE'; value: number }
  | { type: 'SET_WANDER_JITTER'; value: number }
  | { type: 'SET_WANDER_Z_FACTOR'; value: number }
  | { type: 'SET_BOUNDARY_X_RANGE'; value: number }
  | { type: 'SET_BOUNDARY_Y_DOWN'; value: number }
  | { type: 'SET_BOUNDARY_Y_UP'; value: number }
  | { type: 'SET_BOUNDARY_Z_BACK'; value: number }
  | { type: 'SET_BOUNDARY_Z_FRONT'; value: number }
  | { type: 'SET_BOUNDARY_MARGIN'; value: number }
  | { type: 'SET_BOUNDARY_STRENGTH'; value: number }
  | { type: 'SET_BOUNDARY_WEIGHT'; value: number }
  | { type: 'SET_REPULSION_BASE_MIN_DIST'; value: number }
  | { type: 'SET_REPULSION_AMPLITUDE'; value: number }
  | { type: 'SET_REPULSION_SPEED'; value: number }
  | { type: 'SET_REPULSION_STRENGTH'; value: number }
  | { type: 'SET_REPULSION_WEIGHT'; value: number }
  | { type: 'SET_WALL_BOUNCE_FACTOR'; value: number }
  | { type: 'RESET' };

const DEFAULT: SteeringContext = {
  maxSpeed: 1.7,
  maxForce: 3.0,
  mass: 5.0,

  wanderRadius: 1.5,
  wanderDistance: 2.0,
  wanderJitter: 1.5,
  wanderZFactor: 0.6,

  boundaryXRange: 8,
  boundaryYDown: 3,
  boundaryYUp: 4,
  boundaryZBack: 5.0,
  boundaryZFront: 1.5,
  boundaryMargin: 2.5,
  boundaryStrength: 2.0,
  boundaryWeight: 3.0,

  repulsionBaseMinDist: 3.0,
  repulsionAmplitude: 1.5,
  repulsionSpeed: 0.3,
  repulsionStrength: 4.0,
  repulsionWeight: 3.0,

  wallBounceFactor: 0.05,
};

export const steeringMachine = setup({
  types: {} as {
    context: SteeringContext;
    events: SteeringEvents;
  },
}).createMachine({
  id: 'steering',
  initial: 'active',
  context: { ...DEFAULT },
  states: {
    active: {
      on: {
        SET_MAX_SPEED: { actions: assign({ maxSpeed: ({ event }) => event.value }) },
        SET_MAX_FORCE: { actions: assign({ maxForce: ({ event }) => event.value }) },
        SET_MASS: { actions: assign({ mass: ({ event }) => event.value }) },
        SET_WANDER_RADIUS: { actions: assign({ wanderRadius: ({ event }) => event.value }) },
        SET_WANDER_DISTANCE: { actions: assign({ wanderDistance: ({ event }) => event.value }) },
        SET_WANDER_JITTER: { actions: assign({ wanderJitter: ({ event }) => event.value }) },
        SET_WANDER_Z_FACTOR: { actions: assign({ wanderZFactor: ({ event }) => event.value }) },
        SET_BOUNDARY_X_RANGE: { actions: assign({ boundaryXRange: ({ event }) => event.value }) },
        SET_BOUNDARY_Y_DOWN: { actions: assign({ boundaryYDown: ({ event }) => event.value }) },
        SET_BOUNDARY_Y_UP: { actions: assign({ boundaryYUp: ({ event }) => event.value }) },
        SET_BOUNDARY_Z_BACK: { actions: assign({ boundaryZBack: ({ event }) => event.value }) },
        SET_BOUNDARY_Z_FRONT: { actions: assign({ boundaryZFront: ({ event }) => event.value }) },
        SET_BOUNDARY_MARGIN: { actions: assign({ boundaryMargin: ({ event }) => event.value }) },
        SET_BOUNDARY_STRENGTH: { actions: assign({ boundaryStrength: ({ event }) => event.value }) },
        SET_BOUNDARY_WEIGHT: { actions: assign({ boundaryWeight: ({ event }) => event.value }) },
        SET_REPULSION_BASE_MIN_DIST: { actions: assign({ repulsionBaseMinDist: ({ event }) => event.value }) },
        SET_REPULSION_AMPLITUDE: { actions: assign({ repulsionAmplitude: ({ event }) => event.value }) },
        SET_REPULSION_SPEED: { actions: assign({ repulsionSpeed: ({ event }) => event.value }) },
        SET_REPULSION_STRENGTH: { actions: assign({ repulsionStrength: ({ event }) => event.value }) },
        SET_REPULSION_WEIGHT: { actions: assign({ repulsionWeight: ({ event }) => event.value }) },
        SET_WALL_BOUNCE_FACTOR: { actions: assign({ wallBounceFactor: ({ event }) => event.value }) },
        RESET: { actions: assign(DEFAULT) },
      },
    },
  },
});
