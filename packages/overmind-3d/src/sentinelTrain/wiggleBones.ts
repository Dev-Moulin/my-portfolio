import * as THREE from 'three';
import { WiggleBone } from 'wiggle';

/**
 * Spring-bone wiggle setup for one armature.
 *
 * Algorithm (`wiggle` lib by KMkota0 / Xavier):
 *   - The root bone is animated directly (in our case via parenting under Eye_Rig
 *     which moves along the curve). Wiggle leaves the root alone.
 *   - Every CHILD bone whose parent is also a bone gets wrapped in a WiggleBone.
 *     At each `.update()` the wiggle interpolates the bone's world position
 *     toward its "rest" position with a velocity factor → swing + lag effect.
 *
 * @param armature  the root Object3D node that contains the bone tree (e.g. "ArmatureBIG1")
 * @param velocity  catch-up speed (lower = looser/more lag, higher = stiffer). Default 0.15.
 * @returns an array of WiggleBone instances (call `.update()` on each every frame).
 */
export function setupArmatureWiggle(
  armature: THREE.Object3D,
  velocity = 0.15,
): WiggleBoneInstance[] {
  // IMPORTANT: snapshot the bone list BEFORE creating any WiggleBone.
  // WiggleBone re-parents each bone under an inserted clone, which mutates the
  // tree mid-traverse: real bones get skipped and the inserted clones get visited
  // (and wiggled) instead — chains end up rigid or double-wiggled.
  const bones: THREE.Bone[] = [];
  armature.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone);
  });

  const wiggleBones: WiggleBoneInstance[] = [];
  for (const bone of bones) {
    const parent = bone.parent as THREE.Bone | null;
    if (!parent || !parent.isBone) continue; // skip root bones
    const wb = new WiggleBone(bone, { velocity });
    wiggleBones.push(wb as WiggleBoneInstance);
  }
  return wiggleBones;
}

/**
 * Setup wiggle on multiple armatures by their object names. Logs which ones were
 * found vs missing for easy debug.
 */
export function setupCreatureWiggles(
  model: THREE.Object3D,
  armatureNames: string[],
  velocity = 0.15,
): {
  wiggles: WiggleBoneInstance[];
  foundArmatures: string[];
  missingArmatures: string[];
  perArmature: Array<{ name: string; totalBones: number; wiggleBones: number }>;
} {
  const wiggles: WiggleBoneInstance[] = [];
  const found: string[] = [];
  const missing: string[] = [];
  const perArmature: Array<{ name: string; totalBones: number; wiggleBones: number }> = [];
  for (const name of armatureNames) {
    // GLTFLoader strips dots from node names ("Armature.000" → "Armature000"),
    // so try the original name first, then the dotless/underscored variants.
    const arm =
      model.getObjectByName(name) ??
      model.getObjectByName(name.replace(/\./g, '')) ??
      model.getObjectByName(name.replace(/\./g, '_'));
    if (!arm) {
      missing.push(name);
      continue;
    }
    found.push(arm.name);
    let totalBones = 0;
    arm.traverse((o) => { if ((o as THREE.Bone).isBone) totalBones += 1; });
    const ws = setupArmatureWiggle(arm, velocity);
    perArmature.push({ name: arm.name, totalBones, wiggleBones: ws.length });
    wiggles.push(...ws);
  }
  return { wiggles, foundArmatures: found, missingArmatures: missing, perArmature };
}

/** Update all wiggle bones for the current frame (call from your render loop). */
export function updateWiggles(wiggles: WiggleBoneInstance[]): void {
  for (const w of wiggles) w.update();
}

/** Dispose all wiggle bones (restores original bone parenting). */
export function disposeWiggles(wiggles: WiggleBoneInstance[]): void {
  for (const w of wiggles) w.dispose();
}

/** Minimal structural type for the wiggle lib (no .d.ts shipped). */
export interface WiggleBoneInstance {
  update(): void;
  reset(): void;
  dispose(): void;
  /** Internal spring memory: the bone's smoothed world position (exposed by the lib). */
  oldBoneWorldPosition: THREE.Vector3;
}

// ── Collision sphère bras ↔ œil ──────────────────────────────────────────────
// La lib wiggle n'a aucune gestion de collision. On contraint sa MÉMOIRE de
// ressort (`oldBoneWorldPosition`) : si elle entre dans la sphère de l'œil, on
// la reprojette à la surface → au prochain step le ressort repart de là, et les
// bras "glissent" autour de l'œil au lieu de le traverser (1 frame de latence,
// imperceptible à 60fps).

/**
 * Sélectionne les wiggle bones à contraindre : uniquement ceux dont la position
 * de REPOS est hors de la sphère. Les bones de base des bras (attachés à
 * l'arrière de l'œil, donc en permanence proches du centre) sont exclus, sinon
 * ils seraient repoussés en continu.
 */
export function setupEyeCollision(
  wiggles: WiggleBoneInstance[],
  eyeCenterWorld: THREE.Vector3,
  radius: number,
): WiggleBoneInstance[] {
  return wiggles.filter(
    (w) => w.oldBoneWorldPosition.distanceTo(eyeCenterWorld) > radius * 1.02,
  );
}

/** Repousse hors de la sphère les positions mémorisées qui y sont entrées. */
export function applyEyeCollision(
  constrained: WiggleBoneInstance[],
  center: THREE.Vector3,
  radius: number,
  tmp: THREE.Vector3,
): void {
  const r2 = radius * radius;
  for (const w of constrained) {
    const p = w.oldBoneWorldPosition;
    const d2 = p.distanceToSquared(center);
    if (d2 < r2 && d2 > 1e-10) {
      tmp.copy(p).sub(center).normalize().multiplyScalar(radius);
      p.copy(center).add(tmp);
    }
  }
}
