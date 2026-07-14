import * as THREE from 'three';
import type { ScrollProgress } from '../scene/scrollCameraAnimator.ts';

/**
 * Système de navigation "wander" de la sentinelle (V1.3).
 *
 * 3 zones (B/C/D) = volumes de balade libre ; 3 trajectoires = courbes de liaison.
 * Comportement (Reynolds) : la créature erre dans sa zone courante ; au déclenchement
 * d'un trajet (scroll), elle rejoint le point le plus proche de la courbe (closest
 * point) AVEC RETARD (ressort), puis suit la courbe (t piloté par le scroll) jusqu'à
 * la zone d'arrivée, où elle reprend le wander.
 *
 * ⚠️ Coords du JSON en MONDE BLENDER Z-up → conversion (x,y,z)→(x,z,-y) = espace
 * GLB-local (même repère que le reste du SentinelCreatureSystem). Le navigateur
 * travaille DONC en GLB-local ; la conversion vers le monde de scène est faite par
 * l'appelant (model.localToWorld).
 *
 * ⚠️ La courbe nommée "DB" est en réalité tracée B→D (from Wander.001 to Wander.003).
 * Le mapping trajet→courbe se base sur les zones from/to, pas sur le nom.
 */

// ── Réglages ──────────────────────────────────────────────────────────────────
/** Remplissage de la bbox par la balade (0.7 = la cible reste dans 70% de la zone). */
const WANDER_FILL = 0.7;
/** Lissage de la position de wander (plus bas = flotte plus lentement). */
const WANDER_SMOOTH = 0.02;
/** Lissage du poids dwell↔traverse (anti-snap). */
const MODE_WEIGHT_SMOOTH = 0.04;
/** Lissage du t en traverse = LE RETARD (plus bas = rejoint plus mollement). */
const TRAVERSE_T_SMOOTH = 0.06;
/** Ressort de position en traverse (rejoint la courbe sans se téléporter). */
const POS_SMOOTH = 0.10;
/** Écart de t pour le look-ahead le long de la courbe. */
const LOOK_AHEAD = 0.05;
/** Écart de t pour mesurer le virage (banking). */
const BANK_LOOKAHEAD = 0.03;
/** Nb d'échantillons pour le closest-point. */
const CLOSEST_SAMPLES = 60;
/** Accélération de la sentinelle en traverse (BC/CD/DB, dans les 2 sens). 1.15 = +15% :
 *  elle parcourt sa courbe plus vite que la caméra et arrive un peu en avance (clampé). */
const TRAVERSE_SPEED = 1.15;

export type ZoneId = 'B' | 'C' | 'D';

/** Mapping point de repos caméra → zone wander (l'arrivée AB tombe sur Wander.001=B). */
const ZONE_OF_POINT: Record<string, ZoneId | null> = {
  A: null, B: 'B', C: 'C', D: 'D',
};
/** Mapping nœud Wander → zone. VALIDÉ VISUELLEMENT par l'user : `.002`=C, `.003`=D.
 *  (⚠️ le `naming_caveats` du JSON Blender dit l'inverse `.002=D/.003=C` — FAUX au rendu :
 *  caméra en C → sentinelle en D. On garde le mapping validé à l'écran.) */
const ZONE_ID_OF_NODE: Record<string, ZoneId> = {
  'Wander.001': 'B', 'Wander.002': 'C', 'Wander.003': 'D',
};

interface WanderZone {
  id: ZoneId;
  center: THREE.Vector3;   // centre de l'ellipsoïde, GLB-local (Three)
  radii: THREE.Vector3;    // demi-axes [rx,ry,rz], GLB-local (Three)
  radius: number;          // sphère englobante (max des demi-axes) — debug/legacy
}
interface WanderTrajectory {
  fromZone: ZoneId;
  toZone: ZoneId;
  curve: THREE.CatmullRomCurve3;
  samples: THREE.Vector3[]; // pré-échantillonné pour le closest-point
}
export interface WanderNavData {
  /** Trajectoires (JSON, Blender Z-up → converties Y-up). */
  trajectories: WanderTrajectory[];
  /** Zones B/C/D = ellipsoïdes lisses (JSON V2.2), en espace GLB-local. */
  zones: Record<ZoneId, WanderZone>;
}

/** Conversion monde Blender Z-up → three Y-up (= espace GLB-local). */
function blenderToThree(v: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[2], -v[1]);
}

/** Charge + convertit Wander_navigation.json. */
export async function loadWanderNavigation(basePath: string): Promise<WanderNavData> {
  const url = `${basePath}data/Wander_navigation.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[wanderNav] failed to load ${url}: ${res.status}`);
  const raw = await res.json();

  // ── Zones = ELLIPSOÏDES (JSON V2.2) : center_world + _radii_three_hint (demi-axes déjà
  //    en ordre Three [rx,rz,ry]). Fallback radii_world (Blender) → swap y/z.
  const zones = {} as Record<ZoneId, WanderZone>;
  for (const node of Object.keys(ZONE_ID_OF_NODE)) {
    const z = raw[node];
    const id = ZONE_ID_OF_NODE[node];
    if (!z?.center_world) continue;
    const center = blenderToThree(z.center_world);
    const hint: number[] | null = z._radii_three_hint
      ?? (z.radii_world ? [z.radii_world[0], z.radii_world[2], z.radii_world[1]] : null);
    if (!hint) continue;
    const radii = new THREE.Vector3(Math.abs(hint[0]), Math.abs(hint[1]), Math.abs(hint[2]));
    zones[id] = { id, center, radii, radius: Math.max(radii.x, radii.y, radii.z) };
  }

  // ── Trajectoires : mapping basé sur from_zone/to_zone (PAS le nom du clip, qui ment).
  const trajectories: WanderTrajectory[] = [];
  for (const key of Object.keys(raw.trajectories ?? {})) {
    const t = raw.trajectories[key];
    const fromZone = ZONE_ID_OF_NODE[t.from_zone];
    const toZone = ZONE_ID_OF_NODE[t.to_zone];
    if (!fromZone || !toZone) continue;
    const pts: THREE.Vector3[] = (t.polyline_world_step20 as [number, number, number][]).map(blenderToThree);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    trajectories.push({ fromZone, toZone, curve, samples: curve.getSpacedPoints(CLOSEST_SAMPLES) });
  }
  console.log(`[wanderNav] loaded ${Object.keys(zones).length} ellipsoid zones + ${trajectories.length} trajectories`);
  return { trajectories, zones };
}

/** Géométrie d'une zone (cadre/volume) en espace GLB-local. */
export interface ZoneGeometry {
  center: THREE.Vector3;
  radius: number;
  bboxMin: THREE.Vector3;
  bboxMax: THREE.Vector3;
  tris: THREE.Triangle[];
}

/**
 * Lit un mesh-zone du GLB (par nom, tolérant aux dots strippés) → géométrie en espace
 * GLB-local (center, AABB, triangles). Réutilisé par la sentinelle (Wander.00x) ET par
 * l'Overmind (WanderOvermind). Lit la géométrie même si le mesh est masqué (nav data).
 */
export function extractZoneGeometry(model: THREE.Object3D, meshName: string): ZoneGeometry | null {
  model.updateMatrixWorld(true);
  const find = (name: string): THREE.Object3D | null =>
    model.getObjectByName(name) ??
    model.getObjectByName(name.replace(/\./g, '')) ??
    model.getObjectByName(name.replace(/\./g, '_')) ?? null;
  const mesh = find(meshName) as THREE.Mesh | null;
  if (!mesh || !mesh.isMesh) {
    console.warn(`[wanderNav] zone mesh ${meshName} not found in GLB`);
    return null;
  }
  const geo = mesh.geometry as THREE.BufferGeometry;
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const verts: THREE.Vector3[] = [];
  const bboxMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const bboxMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    mesh.localToWorld(v);
    model.worldToLocal(v);          // → GLB-local
    verts.push(v.clone());
    bboxMin.min(v); bboxMax.max(v); center.add(v);
  }
  if (posAttr.count > 0) center.divideScalar(posAttr.count);
  const tris: THREE.Triangle[] = [];
  const index = geo.index;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      tris.push(new THREE.Triangle(verts[index.getX(i)], verts[index.getX(i + 1)], verts[index.getX(i + 2)]));
    }
  } else {
    for (let i = 0; i + 2 < verts.length; i += 3) {
      tris.push(new THREE.Triangle(verts[i], verts[i + 1], verts[i + 2]));
    }
  }
  const radius = Math.max(center.distanceTo(bboxMin), center.distanceTo(bboxMax));
  return { center, radius, bboxMin, bboxMax, tris };
}

// ── Navigator ───────────────────────────────────────────────────────────────

type Mode = 'DWELL' | 'TRAVERSE';

export class WanderNavigator {
  private data: WanderNavData;
  private camera: THREE.Camera;
  private model: THREE.Object3D;

  private zones: Record<ZoneId, WanderZone>;  // lues depuis le GLB
  private mode: Mode = 'DWELL';
  private zone: ZoneId = 'B';
  private traj: WanderTrajectory | null = null;
  private dir: 1 | -1 = 1;
  private tScroll = 0;     // cible (scroll) sur la courbe, 0..1
  private tCurrent = 0;    // t lissé (donne le retard)
  private justEnteredTraverse = false;

  private posGlb = new THREE.Vector3();   // position lissée (GLB)
  private modeWeight = 1;                  // 1 = dwell, 0 = traverse (lissé)
  private seeded = false;

  // temps
  private camGlb = new THREE.Vector3();
  private wTarget = new THREE.Vector3();
  private projTmp = new THREE.Vector3();
  private curvePt = new THREE.Vector3();
  private tanTmp = new THREE.Vector3();
  private tanA = new THREE.Vector3();
  private tanB = new THREE.Vector3();

  // debug
  private debugGroup: THREE.Group | null = null;

  constructor(data: WanderNavData, camera: THREE.Camera, model: THREE.Object3D) {
    this.data = data;
    this.camera = camera;
    this.model = model;
    this.zones = data.zones;  // ellipsoïdes lus du JSON (V2.2)
    if (this.zones.B) this.posGlb.copy(this.zones.B.center);
  }

  /** Traduit le ScrollProgress (hors AB) en état DWELL/TRAVERSE. */
  setScrollProgress(p: ScrollProgress): void {
    if (p.segment === null || p.segment === 'AB') {
      // Dwell dans la zone du point de repos (ignore A — géré en mode AB par la créature)
      const z = ZONE_OF_POINT[p.restPoint];
      if (z) { this.mode = 'DWELL'; this.zone = z; }
      return;
    }
    // Trajet : trouver la courbe reliant {from,to} et le sens
    const from = ZONE_OF_POINT[p.from];
    const to = ZONE_OF_POINT[p.to];
    if (!from || !to || from === to) return;
    const traj = this.data.trajectories.find(
      (t) => (t.fromZone === from && t.toZone === to) || (t.fromZone === to && t.toZone === from),
    );
    if (!traj) return;
    const dir: 1 | -1 = traj.fromZone === from ? 1 : -1;
    if (this.mode !== 'TRAVERSE' || this.traj !== traj || this.dir !== dir) {
      this.justEnteredTraverse = true;
    }
    this.mode = 'TRAVERSE';
    this.traj = traj;
    this.dir = dir;
    // tCurve = p.t si on suit la courbe dans son sens natif, sinon 1-p.t.
    // Accéléré de +15% (clampé) : la sentinelle file plus vite que la caméra sur la courbe.
    const tp = Math.min(1, p.t * TRAVERSE_SPEED);
    this.tScroll = dir === 1 ? tp : 1 - tp;
  }

  /** Vrai si la créature est au repos DANS la zone B (→ pilotée par le clip baké `wander_B`). */
  isDwellB(): boolean {
    return this.mode === 'DWELL' && this.zone === 'B';
  }

  /**
   * Cible de la frame. `currentPos` = position GLB actuelle de la créature (continuité +
   * closest-point). Remplit outPos (position cible GLB) et outLook (point de visée GLB).
   * @returns wanderWeight (1 dwell → 0 traverse) pour le slerp face-caméra.
   */
  computeTarget(
    dt: number, elapsed: number,
    currentPos: THREE.Vector3,
    outPos: THREE.Vector3, outLook: THREE.Vector3,
  ): { wanderWeight: number; turn: number } {
    if (!this.seeded) { this.posGlb.copy(currentPos); this.seeded = true; }
    let turn = 0;

    // Caméra en GLB-local (pour exclusion cône + face-caméra)
    this.camera.getWorldPosition(this.camGlb);
    this.model.worldToLocal(this.camGlb);

    const targetMode = this.mode === 'DWELL' ? 1 : 0;
    this.modeWeight += (targetMode - this.modeWeight) * MODE_WEIGHT_SMOOTH;

    if (this.mode === 'TRAVERSE' && this.traj) {
      // Closest-point à l'entrée du trajet (rejoint depuis la position de wander)
      if (this.justEnteredTraverse) {
        this.tCurrent = this.closestT(this.traj, currentPos);
        this.justEnteredTraverse = false;
      }
      // Ressort de t = retard ; ressort de position = pas de téléportation
      this.tCurrent += (this.tScroll - this.tCurrent) * TRAVERSE_T_SMOOTH;
      const tc = Math.max(0, Math.min(1, this.tCurrent));
      this.traj.curve.getPointAt(tc, this.curvePt);
      this.posGlb.lerp(this.curvePt, POS_SMOOTH);
      // Look-ahead le long de la courbe (sens dir)
      const tLook = Math.max(0, Math.min(1, tc + this.dir * LOOK_AHEAD));
      this.traj.curve.getPointAt(tLook, outLook);
      if (outLook.distanceToSquared(this.posGlb) < 1e-6) {
        this.traj.curve.getTangentAt(tc, this.tanTmp);
        outLook.copy(this.posGlb).addScaledVector(this.tanTmp, this.dir * 4);
      }
      // Banking : taux de virage horizontal (deux tangentes, comme le vol AB)
      this.traj.curve.getTangentAt(tc, this.tanA).multiplyScalar(this.dir);
      this.traj.curve.getTangentAt(Math.max(0, Math.min(1, tc + this.dir * BANK_LOOKAHEAD)), this.tanB).multiplyScalar(this.dir);
      this.tanA.y = 0; this.tanB.y = 0;
      if (this.tanA.lengthSq() > 1e-6 && this.tanB.lengthSq() > 1e-6) {
        this.tanA.normalize(); this.tanB.normalize();
        const crossY = this.tanA.x * this.tanB.z - this.tanA.z * this.tanB.x;
        turn = Math.asin(Math.max(-1, Math.min(1, crossY)));
      }
    } else {
      // DWELL : balade À L'INTÉRIEUR de l'ellipsoïde de la zone (V2.2), confinement radial doux.
      const z = this.zones[this.zone];
      if (!z) { outLook.copy(this.camGlb); outPos.copy(this.posGlb); return { wanderWeight: this.modeWeight, turn }; }
      const e = elapsed * 0.5;
      // Cible flottante DANS l'ellipsoïde (rayons × WANDER_FILL → reste à l'intérieur).
      this.wTarget.set(
        z.center.x + Math.sin(e * 0.26) * z.radii.x * WANDER_FILL,
        z.center.y + Math.sin(e * 0.34 + 1.3) * z.radii.y * WANDER_FILL,
        z.center.z + Math.cos(e * 0.21 + 2.1) * z.radii.z * WANDER_FILL,
      );
      this.posGlb.lerp(this.wTarget, WANDER_SMOOTH);
      // Confinement : si la position lissée sort de l'ellipsoïde (|d|>1), la reprojeter
      // sur la surface (rappel radial dur en dernier recours ; la cible interne suffit en régime).
      this.projTmp.copy(this.posGlb).sub(z.center);
      const dx = this.projTmp.x / z.radii.x, dy = this.projTmp.y / z.radii.y, dz = this.projTmp.z / z.radii.z;
      const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (m > 1) this.posGlb.copy(z.center).addScaledVector(this.projTmp, 1 / m);
      // Visée = caméra (face utilisateur)
      outLook.copy(this.camGlb);
    }

    outPos.copy(this.posGlb);
    return { wanderWeight: this.modeWeight, turn };
  }

  private closestT(traj: WanderTrajectory, p: THREE.Vector3): number {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < traj.samples.length; i++) {
      const d = traj.samples[i].distanceToSquared(p);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best / (traj.samples.length - 1);
  }

  /** Ellipsoïdes des zones + lignes des trajectoires (debug DevPanel). Enfants du model (GLB). */
  setDebug(opts: { zones?: boolean; trajectories?: boolean }): void {
    if (!this.debugGroup) {
      this.debugGroup = new THREE.Group();
      this.debugGroup.name = 'WanderNavDebug';
      const colors: Record<ZoneId, number> = { B: 0x00ccff, C: 0x33ff66, D: 0xff9933 };
      for (const id of ['B', 'C', 'D'] as ZoneId[]) {
        const z = this.zones[id];
        if (!z) continue;
        // Wireframe de l'ELLIPSOÏDE de la zone (sphère unité mise à l'échelle des demi-axes).
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 12),
          new THREE.MeshBasicMaterial({
            color: colors[id], wireframe: true, transparent: true, opacity: 0.3,
            depthWrite: false, side: THREE.DoubleSide,
          }),
        );
        sphere.position.copy(z.center);
        sphere.scale.copy(z.radii);
        sphere.userData.kind = 'zone';
        this.debugGroup.add(sphere);
      }
      for (const t of this.data.trajectories) {
        const geo = new THREE.BufferGeometry().setFromPoints(t.curve.getPoints(80));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        line.userData.kind = 'traj';
        this.debugGroup.add(line);
      }
      this.model.add(this.debugGroup);
    }
    for (const c of this.debugGroup.children) {
      if (c.userData.kind === 'zone') c.visible = opts.zones ?? c.visible;
      if (c.userData.kind === 'traj') c.visible = opts.trajectories ?? c.visible;
    }
  }

  dispose(): void {
    if (this.debugGroup) {
      this.debugGroup.removeFromParent();
      this.debugGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = (m as THREE.Mesh).material as THREE.Material | undefined;
        if (mat && !Array.isArray(mat)) mat.dispose();
      });
      this.debugGroup = null;
    }
  }
}
