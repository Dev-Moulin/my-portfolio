import * as THREE from 'three';

/**
 * Loader du JSON des trajets `Spaceship_NewV1.1_paths.json`.
 *
 * Différences avec `sentinelTrain/pathLoader.ts` (banc d'essai) :
 *  - structure `{ meta, sentinel_paths: {AB,BC,CD}, camera_paths: {AB…DB} }`
 *  - espace MONDE Y-up du GLB, PAS recentré → un point du JSON correspond
 *    directement à une position dans l'espace local de `gltf.scene`
 *  - `frames` des chemins sentinelle est une string ("1-499 (offset…)"),
 *    `frames` des chemins caméra est un tuple [start, end]
 */

export interface BezierPoint {
  co: [number, number, number];
  hl: [number, number, number];
  hr: [number, number, number];
}

export interface SentinelPathEntry {
  points: BezierPoint[];
  frames?: string;
  direction?: string;
}

export interface CameraPathEntry {
  points: BezierPoint[];
  glb_animation: string;
  frames: [number, number];
  focal_animated?: boolean;
  focal_note?: string;
}

export interface SpaceshipPathsData {
  meta: { space: string; fps: number; frame_range: [number, number]; timeline: string };
  sentinel_paths: Record<string, SentinelPathEntry>;
  camera_paths: Record<string, CameraPathEntry>;
}

/** Chaîne une CubicBezierCurve3 par paire de points adjacents (co, hr, hl, co). */
export function buildBezierCurve(points: BezierPoint[]): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(...points[i].co),
      new THREE.Vector3(...points[i].hr),
      new THREE.Vector3(...points[i + 1].hl),
      new THREE.Vector3(...points[i + 1].co),
    ));
  }
  return path;
}

export async function loadSpaceshipPaths(basePath: string): Promise<{
  data: SpaceshipPathsData;
  /** Courbe sentinelle A→B, espace local du GLB (Y-up monde, non recentré). */
  sentinelAB: THREE.CurvePath<THREE.Vector3>;
}> {
  const url = `${basePath}data/Spaceship_NewV1.1_paths.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[spaceshipPaths] failed to load ${url}: ${res.status}`);
  const data = await res.json() as SpaceshipPathsData;
  const ab = data.sentinel_paths?.AB;
  if (!ab || ab.points.length < 2) throw new Error('[spaceshipPaths] sentinel_paths.AB missing or too short');
  return { data, sentinelAB: buildBezierCurve(ab.points) };
}
