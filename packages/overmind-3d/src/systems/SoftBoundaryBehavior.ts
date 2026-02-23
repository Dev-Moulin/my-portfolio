import * as YUKA from 'yuka';

export interface SoftBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin?: number;
  zMax?: number;
}

/**
 * Soft repulsion behavior at the edges of a rectangular XY zone.
 *
 * Instead of hard clamping (which kills wander direction and causes
 * linear back-and-forth), this behavior applies a progressive force
 * pushing the vehicle inward when approaching an edge.
 *
 * Force curve: quadratic (t²) — gentle at start, strong at edge.
 * The vehicle "feels" the edge and turns naturally before reaching it.
 */
export class SoftBoundaryBehavior extends YUKA.SteeringBehavior {
  bounds: SoftBounds;
  margin: number;
  strength: number;

  constructor(bounds: SoftBounds, margin = 1.2, strength = 3.0) {
    super();
    this.bounds = bounds;
    this.margin = margin;
    this.strength = strength;
  }

  calculate(vehicle: YUKA.Vehicle, force: YUKA.Vector3, _delta: number): YUKA.Vector3 {
    const pos = vehicle.position;
    const b = this.bounds;
    const m = this.margin;

    force.set(0, 0, 0);

    // X axis — left edge
    const distLeft = pos.x - b.xMin;
    if (distLeft < m) {
      if (distLeft >= 0) {
        const t = 1 - (distLeft / m);
        force.x += t * t * this.strength;
      } else {
        force.x += this.strength;
      }
    }

    // X axis — right edge
    const distRight = b.xMax - pos.x;
    if (distRight < m) {
      if (distRight >= 0) {
        const t = 1 - (distRight / m);
        force.x -= t * t * this.strength;
      } else {
        force.x -= this.strength;
      }
    }

    // Y axis — bottom edge
    const distBottom = pos.y - b.yMin;
    if (distBottom < m) {
      if (distBottom >= 0) {
        const t = 1 - (distBottom / m);
        force.y += t * t * this.strength;
      } else {
        force.y += this.strength;
      }
    }

    // Y axis — top edge
    const distTop = b.yMax - pos.y;
    if (distTop < m) {
      if (distTop >= 0) {
        const t = 1 - (distTop / m);
        force.y -= t * t * this.strength;
      } else {
        force.y -= this.strength;
      }
    }

    // Z axis — front edge (optional)
    if (b.zMin !== undefined) {
      const distFront = pos.z - b.zMin;
      if (distFront < m) {
        if (distFront >= 0) {
          const t = 1 - (distFront / m);
          force.z += t * t * this.strength;
        } else {
          force.z += this.strength;
        }
      }
    }

    // Z axis — back edge (optional)
    if (b.zMax !== undefined) {
      const distBack = b.zMax - pos.z;
      if (distBack < m) {
        if (distBack >= 0) {
          const t = 1 - (distBack / m);
          force.z -= t * t * this.strength;
        } else {
          force.z -= this.strength;
        }
      }
    }

    // If no Z bounds defined, zero out Z force
    if (b.zMin === undefined && b.zMax === undefined) {
      force.z = 0;
    }

    return force;
  }

  setBounds(bounds: Partial<SoftBounds>): void {
    if (bounds.xMin !== undefined) this.bounds.xMin = bounds.xMin;
    if (bounds.xMax !== undefined) this.bounds.xMax = bounds.xMax;
    if (bounds.yMin !== undefined) this.bounds.yMin = bounds.yMin;
    if (bounds.yMax !== undefined) this.bounds.yMax = bounds.yMax;
    if (bounds.zMin !== undefined) this.bounds.zMin = bounds.zMin;
    if (bounds.zMax !== undefined) this.bounds.zMax = bounds.zMax;
  }
}
