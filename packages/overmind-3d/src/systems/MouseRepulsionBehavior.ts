import * as YUKA from 'yuka';

// Reusable vector (no allocation per frame)
const _toVehicle = new YUKA.Vector3();

/**
 * Custom behavior: the eye flees the mouse when it gets too close.
 * The minimum distance varies sinusoidally for an organic "breathing" effect.
 *
 * When the mouse approaches, the eye gently moves away.
 * The pulsing min distance makes the eye seem to hesitate or breathe.
 * If the mouse pursues, the eye flees while maintaining distance.
 * When the mouse moves away, the eye resumes natural wandering.
 */
export class MouseRepulsionBehavior extends YUKA.SteeringBehavior {
  baseMinDistance: number;
  variationAmplitude: number;
  variationSpeed: number;
  strength: number;

  private _time = 0;
  private _mouseWorldX = 0;
  private _mouseWorldY = 0;

  constructor(
    baseMinDistance = 3.0,
    variationAmplitude = 1.5,
    variationSpeed = 0.3,
    strength = 4.0,
  ) {
    super();
    this.baseMinDistance = baseMinDistance;
    this.variationAmplitude = variationAmplitude;
    this.variationSpeed = variationSpeed;
    this.strength = strength;
  }

  setMousePosition(worldX: number, worldY: number): void {
    this._mouseWorldX = worldX;
    this._mouseWorldY = worldY;
  }

  calculate(vehicle: YUKA.Vehicle, force: YUKA.Vector3, delta: number): YUKA.Vector3 {
    this._time += delta;

    // Sinusoidal minimum distance variation
    const currentMinDist = this.baseMinDistance
      + Math.sin(this._time * this.variationSpeed * Math.PI * 2) * this.variationAmplitude;

    // Vector from mouse to vehicle (XY plane only)
    _toVehicle.x = vehicle.position.x - this._mouseWorldX;
    _toVehicle.y = vehicle.position.y - this._mouseWorldY;
    _toVehicle.z = 0;
    const distance = _toVehicle.length();

    // If too close → repel with quadratic force
    if (distance < currentMinDist && distance > 0.01) {
      const t = 1.0 - (distance / currentMinDist); // 0 at edge, 1 at center
      const repulsionForce = t * t * this.strength;

      _toVehicle.normalize();
      force.x = _toVehicle.x * repulsionForce;
      force.y = _toVehicle.y * repulsionForce;
      force.z = 0;
    } else {
      force.set(0, 0, 0);
    }

    return force;
  }
}
