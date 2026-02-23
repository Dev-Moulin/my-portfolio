import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { steeringMachine } from '../machines/steeringMachine.ts';

export function useSteering(actor: ActorRefFrom<typeof steeringMachine>) {
  const ctx = useSelector(actor, (s) => s.context);

  return {
    ...ctx,
    setMaxSpeed: (v: number) => actor.send({ type: 'SET_MAX_SPEED', value: v }),
    setMaxForce: (v: number) => actor.send({ type: 'SET_MAX_FORCE', value: v }),
    setMass: (v: number) => actor.send({ type: 'SET_MASS', value: v }),
    setWanderRadius: (v: number) => actor.send({ type: 'SET_WANDER_RADIUS', value: v }),
    setWanderDistance: (v: number) => actor.send({ type: 'SET_WANDER_DISTANCE', value: v }),
    setWanderJitter: (v: number) => actor.send({ type: 'SET_WANDER_JITTER', value: v }),
    setWanderZFactor: (v: number) => actor.send({ type: 'SET_WANDER_Z_FACTOR', value: v }),
    setBoundaryXRange: (v: number) => actor.send({ type: 'SET_BOUNDARY_X_RANGE', value: v }),
    setBoundaryYDown: (v: number) => actor.send({ type: 'SET_BOUNDARY_Y_DOWN', value: v }),
    setBoundaryYUp: (v: number) => actor.send({ type: 'SET_BOUNDARY_Y_UP', value: v }),
    setBoundaryZBack: (v: number) => actor.send({ type: 'SET_BOUNDARY_Z_BACK', value: v }),
    setBoundaryZFront: (v: number) => actor.send({ type: 'SET_BOUNDARY_Z_FRONT', value: v }),
    setBoundaryMargin: (v: number) => actor.send({ type: 'SET_BOUNDARY_MARGIN', value: v }),
    setBoundaryStrength: (v: number) => actor.send({ type: 'SET_BOUNDARY_STRENGTH', value: v }),
    setBoundaryWeight: (v: number) => actor.send({ type: 'SET_BOUNDARY_WEIGHT', value: v }),
    setRepulsionBaseMinDist: (v: number) => actor.send({ type: 'SET_REPULSION_BASE_MIN_DIST', value: v }),
    setRepulsionAmplitude: (v: number) => actor.send({ type: 'SET_REPULSION_AMPLITUDE', value: v }),
    setRepulsionSpeed: (v: number) => actor.send({ type: 'SET_REPULSION_SPEED', value: v }),
    setRepulsionStrength: (v: number) => actor.send({ type: 'SET_REPULSION_STRENGTH', value: v }),
    setRepulsionWeight: (v: number) => actor.send({ type: 'SET_REPULSION_WEIGHT', value: v }),
    setWallBounceFactor: (v: number) => actor.send({ type: 'SET_WALL_BOUNCE_FACTOR', value: v }),
    reset: () => actor.send({ type: 'RESET' }),
  };
}
