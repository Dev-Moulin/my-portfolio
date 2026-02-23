import * as YUKA from 'yuka';

// Reusable vectors (no allocation per frame)
const _targetLocal = new YUKA.Vector3();
const _ahead = new YUKA.Vector3();
const _targetWorld = new YUKA.Vector3();

/**
 * Wander behavior operating in the XY plane (screen) instead of XZ (ground).
 *
 * Standard Yuka WanderBehavior produces forces only in X and Z (ground plane).
 * For our frontal scene (camera facing XY plane), this custom behavior
 * generates wander in X and Y.
 *
 * Approach: angular perturbation of a point on a wander circle
 * projected ahead of the vehicle in its velocity direction.
 * The angle changes gradually → natural curves (arcs, loops, figure-8s).
 */
export class WanderBehaviorXY extends YUKA.SteeringBehavior {
  radius: number;
  distance: number;
  jitter: number;
  /** Fraction of jitter applied to Z axis (0 = no Z wander, 1 = full) */
  zFactor: number;

  private _targetAngle: number;
  private _zAngle: number;

  constructor(radius = 1.0, distance = 2.0, jitter = 5.0, zFactor = 0) {
    super();
    this.radius = radius;
    this.distance = distance;
    this.jitter = jitter;
    this.zFactor = zFactor;
    this._targetAngle = Math.random() * Math.PI * 2;
    this._zAngle = Math.random() * Math.PI * 2;
  }

  calculate(vehicle: YUKA.Vehicle, force: YUKA.Vector3, delta: number): YUKA.Vector3 {
    // Perturb the target angle — gradual random walk
    const jitterThisSlice = this.jitter * delta;
    this._targetAngle += (Math.random() - 0.5) * 2 * jitterThisSlice;

    // Point on the wander circle (local XY space)
    _targetLocal.x = Math.cos(this._targetAngle) * this.radius;
    _targetLocal.y = Math.sin(this._targetAngle) * this.radius;
    _targetLocal.z = 0;

    // Movement direction in XY plane
    const vx = vehicle.velocity.x;
    const vy = vehicle.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (speed > 0.001) {
      _ahead.x = (vx / speed) * this.distance;
      _ahead.y = (vy / speed) * this.distance;
      _ahead.z = 0;
    } else {
      // No velocity yet → project in target angle direction (bootstrap)
      _ahead.x = Math.cos(this._targetAngle) * this.distance;
      _ahead.y = Math.sin(this._targetAngle) * this.distance;
      _ahead.z = 0;
    }

    // Target position = vehicle position + ahead projection + circle point
    _targetWorld.x = vehicle.position.x + _ahead.x + _targetLocal.x;
    _targetWorld.y = vehicle.position.y + _ahead.y + _targetLocal.y;
    _targetWorld.z = vehicle.position.z;

    // Steering force = direction toward target
    force.subVectors(_targetWorld, vehicle.position);

    // Optional Z wander — slow independent random walk
    if (this.zFactor > 0) {
      this._zAngle += (Math.random() - 0.5) * 2 * jitterThisSlice * 0.3;
      force.z = Math.sin(this._zAngle) * this.radius * this.zFactor;
    } else {
      force.z = 0;
    }

    return force;
  }
}
