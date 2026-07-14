/**
 * Minimal type declarations for the `wiggle` npm package (no .d.ts ships with it).
 * API surface based on the published source (v0.0.17) and KMkota0/wiggle docs.
 */
declare module 'wiggle' {
  import type { Bone, Scene } from 'three';

  export interface WiggleBoneOptions {
    /** Catch-up speed (lower = looser/laggier, higher = stiffer). Default 0.1. */
    velocity?: number;
    /** Maximum local stretch of the bone away from rest. Default 0.1. */
    maxStretch?: number;
    /** Optional scene for visualizing the helper spheres (debug). */
    scene?: Scene;
  }

  export class WiggleBone {
    constructor(bone: Bone, options?: WiggleBoneOptions, debug?: boolean);
    /** Advance one step. Call every frame after the parent bone moved. */
    update(dt?: number | null): void;
    /** Restore the bone to its rest pose immediately. */
    reset(): void;
    /** Tear down: restores original bone parenting. */
    dispose(): void;
  }
}
