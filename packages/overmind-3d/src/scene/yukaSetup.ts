import * as YUKA from 'yuka';
import { WanderBehaviorXY } from '../systems/WanderBehaviorXY.ts';
import { SoftBoundaryBehavior } from '../systems/SoftBoundaryBehavior.ts';
import { MouseRepulsionBehavior } from '../systems/MouseRepulsionBehavior.ts';
import type { SceneActors, SceneMutableState } from './sceneContext.ts';
import type { ModelSettings } from './types.ts';
import type { SteeringContext } from '../machines/steeringMachine.ts';

export interface YukaResult {
  entityManager: YUKA.EntityManager;
  vehicle: YUKA.Vehicle;
  wanderBehavior: WanderBehaviorXY;
  boundaryBehavior: SoftBoundaryBehavior;
  mouseRepulsion: MouseRepulsionBehavior;
  steeringSub: { unsubscribe: () => void } | undefined;
}

export function setupYuka(
  actors: SceneActors,
  modelSettings: ModelSettings,
  state: SceneMutableState,
  modelSettingsRef: { current: ModelSettings },
): YukaResult {
  const { steeringActor } = actors;
  const st0 = steeringActor?.getSnapshot().context;

  const entityManager = new YUKA.EntityManager();
  const vehicle = new YUKA.Vehicle();
  vehicle.position.set(modelSettings.positionX, modelSettings.positionY, modelSettings.positionZ);
  vehicle.maxSpeed = st0?.maxSpeed ?? 1.7;
  vehicle.maxForce = st0?.maxForce ?? 3.0;
  vehicle.mass = st0?.mass ?? 5.0;

  const zBack0 = st0?.boundaryZBack ?? 5.0;
  const zFront0 = st0?.boundaryZFront ?? 1.5;
  const hasZ0 = (zBack0 + zFront0) > 0;
  const wanderBehavior = new WanderBehaviorXY(
    st0?.wanderRadius ?? 1.5,
    st0?.wanderDistance ?? 2.0,
    st0?.wanderJitter ?? 1.5,
    hasZ0 ? (st0?.wanderZFactor ?? 0.6) : 0,
  );
  wanderBehavior.active = true;

  const xRange = st0?.boundaryXRange ?? 8;
  const yDown = st0?.boundaryYDown ?? 3;
  const yUp = st0?.boundaryYUp ?? 4;
  const boundaryBehavior = new SoftBoundaryBehavior(
    {
      xMin: modelSettings.positionX - xRange, xMax: modelSettings.positionX + xRange,
      yMin: modelSettings.positionY - yDown, yMax: modelSettings.positionY + yUp,
      zMin: hasZ0 ? modelSettings.positionZ - zBack0 : undefined,
      zMax: hasZ0 ? modelSettings.positionZ + zFront0 : undefined,
    },
    st0?.boundaryMargin ?? 2.5,
    st0?.boundaryStrength ?? 2.0,
  );
  boundaryBehavior.weight = st0?.boundaryWeight ?? 3.0;
  boundaryBehavior.active = true;

  const mouseRepulsion = new MouseRepulsionBehavior(
    st0?.repulsionBaseMinDist ?? 3.0,
    st0?.repulsionAmplitude ?? 1.5,
    st0?.repulsionSpeed ?? 0.3,
    st0?.repulsionStrength ?? 4.0,
  );
  mouseRepulsion.weight = st0?.repulsionWeight ?? 3.0;
  mouseRepulsion.active = true;

  // Initialize mutable state
  state.steeringRanges = { xRange, yDown, yUp, zBack: zBack0, zFront: zFront0 };
  state.wallBounceFactor = st0?.wallBounceFactor ?? 0.05;

  vehicle.steering.add(wanderBehavior);
  vehicle.steering.add(boundaryBehavior);
  vehicle.steering.add(mouseRepulsion);
  entityManager.add(vehicle);

  // Subscribe to steeringActor for live updates
  const steeringSub = steeringActor?.subscribe((snapshot: { context: SteeringContext }) => {
    const c = snapshot.context;
    vehicle.maxSpeed = c.maxSpeed;
    vehicle.maxForce = c.maxForce;
    vehicle.mass = c.mass;
    wanderBehavior.radius = c.wanderRadius;
    wanderBehavior.distance = c.wanderDistance;
    wanderBehavior.jitter = c.wanderJitter;

    state.steeringRanges = {
      xRange: c.boundaryXRange, yDown: c.boundaryYDown, yUp: c.boundaryYUp,
      zBack: c.boundaryZBack, zFront: c.boundaryZFront,
    };
    const mPos = modelSettingsRef.current;
    const center = state.cachedEyeTarget ?? { x: mPos.positionX, y: mPos.positionY, z: mPos.positionZ };
    const hasZSt = (c.boundaryZBack + c.boundaryZFront) > 0;
    boundaryBehavior.setBounds({
      xMin: center.x - c.boundaryXRange,
      xMax: center.x + c.boundaryXRange,
      yMin: center.y - c.boundaryYDown,
      yMax: center.y + c.boundaryYUp,
      zMin: hasZSt ? center.z - c.boundaryZBack : undefined,
      zMax: hasZSt ? center.z + c.boundaryZFront : undefined,
    });
    boundaryBehavior.margin = c.boundaryMargin;
    boundaryBehavior.strength = c.boundaryStrength;
    boundaryBehavior.weight = c.boundaryWeight;
    wanderBehavior.zFactor = (c.boundaryZBack + c.boundaryZFront) > 0 ? c.wanderZFactor : 0;
    mouseRepulsion.baseMinDistance = c.repulsionBaseMinDist;
    mouseRepulsion.variationAmplitude = c.repulsionAmplitude;
    mouseRepulsion.variationSpeed = c.repulsionSpeed;
    mouseRepulsion.strength = c.repulsionStrength;
    mouseRepulsion.weight = c.repulsionWeight;
    state.wallBounceFactor = c.wallBounceFactor;
  });

  return { entityManager, vehicle, wanderBehavior, boundaryBehavior, mouseRepulsion, steeringSub };
}
