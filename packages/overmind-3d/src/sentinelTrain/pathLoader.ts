import * as THREE from 'three';

/**
 * Format produced by Blender export (sentinel_train_path.json).
 *
 *  - `co`  = position of the bezier point in world space (Y-up, recentered to origin)
 *  - `hl`  = position of the LEFT handle (controls the curve segment arriving at `co`)
 *  - `hr`  = position of the RIGHT handle (controls the curve segment leaving `co`)
 *
 * All values are absolute world positions, ready to use with THREE.CubicBezierCurve3
 * without any axis conversion.
 */
export interface PathPoint {
  co: [number, number, number];
  hl: [number, number, number];
  hr: [number, number, number];
}

export interface PathSegment {
  points: PathPoint[];
  cyclic: boolean;
  resolution: number;
}

export interface PathData {
  description: string;
  space: 'three_yup_recentered_origin';
  segments: Record<string, PathSegment>;
}

/**
 * Build a THREE.CurvePath by chaining one CubicBezierCurve3 per pair of adjacent
 * bezier points: (p_n.co, p_n.hr, p_{n+1}.hl, p_{n+1}.co).
 *
 * For our training file we only consume the AB segment (32 points, starts at origin).
 * BC and CD are continuations, not needed for the spring-bone tests.
 */
export function buildCurveFromSegment(seg: PathSegment): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const pts = seg.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = new THREE.Vector3(...pts[i].co);
    const c0 = new THREE.Vector3(...pts[i].hr);
    const c1 = new THREE.Vector3(...pts[i + 1].hl);
    const p1 = new THREE.Vector3(...pts[i + 1].co);
    path.add(new THREE.CubicBezierCurve3(p0, c0, c1, p1));
  }
  if (seg.cyclic && pts.length > 1) {
    const last = pts[pts.length - 1];
    const first = pts[0];
    path.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(...last.co),
      new THREE.Vector3(...last.hr),
      new THREE.Vector3(...first.hl),
      new THREE.Vector3(...first.co),
    ));
  }
  return path;
}

/**
 * Fetch the path JSON from the public folder and build the AB curve.
 * Returns the parsed data + the constructed THREE.CurvePath for segment AB.
 */
export async function loadSentinelPath(basePath: string): Promise<{
  data: PathData;
  curveAB: THREE.CurvePath<THREE.Vector3>;
}> {
  const url = `${basePath}data/sentinel_train_path.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[sentinelTrain/pathLoader] failed to load ${url}: ${res.status}`);
  const data = await res.json() as PathData;
  const ab = data.segments.AB;
  if (!ab) throw new Error('[sentinelTrain/pathLoader] segment AB missing in JSON');
  const curveAB = buildCurveFromSegment(ab);
  return { data, curveAB };
}
