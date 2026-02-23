declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    subVectors(a: Vector3, b: Vector3): this;
    multiplyScalar(s: number): this;
    normalize(): this;
    length(): number;
    lengthSq(): number;
    dot(v: Vector3): number;
    cross(v: Vector3): this;
    distanceTo(v: Vector3): number;
    clone(): Vector3;
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;
    constructor();
    calculate(vehicle: Vehicle, force: Vector3, delta: number): Vector3;
  }

  export class SteeringManager {
    add(behavior: SteeringBehavior): this;
    remove(behavior: SteeringBehavior): this;
    clear(): this;
  }

  export class GameEntity {
    position: Vector3;
    rotation: { x: number; y: number; z: number; w: number };
    name: string;
    active: boolean;
  }

  export class MovingEntity extends GameEntity {
    velocity: Vector3;
    maxSpeed: number;
    maxForce: number;
    mass: number;
  }

  export class Vehicle extends MovingEntity {
    steering: SteeringManager;
    constructor();
  }

  export class EntityManager {
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    update(delta: number): this;
    clear(): this;
  }
}
