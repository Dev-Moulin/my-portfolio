import * as THREE from 'three';
import { buildBezierCurve, type SpaceshipPathsData } from './spaceshipPaths.ts';
import type { SelectionSystem } from '../scene/selectionSystem.ts';

/**
 * SentinelCurveEditor — édition « à la Blender » de la courbe AB de la sentinelle.
 *
 * Pour chaque point Bézier du JSON : une sphère verte (co) + deux sphères orange
 * (hl/hr), toutes enregistrées auprès du SelectionSystem existant → clic pour
 * sélectionner, gizmo translate pour déplacer. Déplacer un co entraîne ses deux
 * handles (comme Blender) ; un handle se déplace librement.
 *
 * Tout vit dans un Group enfant du model → les positions locales des sphères
 * SONT les coordonnées GLB du JSON (aucune conversion). À chaque déplacement le
 * JSON en mémoire est mis à jour, la courbe est reconstruite et poussée dans le
 * SentinelCreatureSystem (la sentinelle suit la nouvelle courbe en live).
 * « Export JSON » télécharge le fichier complet, à remettre dans
 * `apps/web/public/data/Spaceship_NewV1.1_paths.json`.
 */

const CO_RADIUS = 0.8;      // unités GLB (×0.25 par le scale du model)
const HANDLE_RADIUS = 0.5;
const CO_COLOR = 0x33ff66;
const HANDLE_COLOR = 0xff9933;
const CURVE_COLOR = 0x00ccff;
const CURVE_SAMPLES = 256;

type PointKind = 'co' | 'hl' | 'hr';

export class SentinelCurveEditor {
  private data: SpaceshipPathsData;
  private selection: SelectionSystem;
  private onCurveChange: (curve: THREE.CurvePath<THREE.Vector3>) => void;

  private group = new THREE.Group();
  private spheres = new Map<string, THREE.Mesh>(); // id → sphère
  private handleLines: THREE.Line[] = [];
  private curveLine: THREE.Line;
  private listener: (id: string, data: { position: THREE.Vector3 }) => void;
  private registeredIds: string[] = [];

  constructor(
    model: THREE.Object3D,
    data: SpaceshipPathsData,
    selection: SelectionSystem,
    onCurveChange: (curve: THREE.CurvePath<THREE.Vector3>) => void,
  ) {
    this.data = data;
    this.selection = selection;
    this.onCurveChange = onCurveChange;

    this.group.name = 'SentinelCurveEditor';
    model.add(this.group); // espace GLB : positions locales = coordonnées du JSON

    const points = data.sentinel_paths.AB.points;
    const coGeo = new THREE.SphereGeometry(CO_RADIUS, 12, 8);
    const handleGeo = new THREE.SphereGeometry(HANDLE_RADIUS, 10, 6);
    const coMat = new THREE.MeshBasicMaterial({ color: CO_COLOR });
    const handleMat = new THREE.MeshBasicMaterial({ color: HANDLE_COLOR });

    points.forEach((p, i) => {
      for (const kind of ['co', 'hl', 'hr'] as PointKind[]) {
        const sphere = new THREE.Mesh(kind === 'co' ? coGeo : handleGeo, kind === 'co' ? coMat : handleMat);
        sphere.position.set(...p[kind]);
        sphere.name = `curve-${kind}-${i}`;
        this.group.add(sphere);
        const id = sphere.name;
        this.spheres.set(id, sphere);
        selection.register(id, sphere);
        this.registeredIds.push(id);
      }
      // Ligne hl—co—hr (mise à jour live)
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p.hl), new THREE.Vector3(...p.co), new THREE.Vector3(...p.hr),
      ]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: HANDLE_COLOR, transparent: true, opacity: 0.5 }));
      this.group.add(line);
      this.handleLines.push(line);
    });

    // Polyline de la courbe
    const curve = buildBezierCurve(points);
    const curveGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(CURVE_SAMPLES));
    this.curveLine = new THREE.Line(curveGeo, new THREE.LineBasicMaterial({ color: CURVE_COLOR }));
    this.group.add(this.curveLine);

    // Déplacements : listener ADDITIONNEL (ne remplace pas celui du gizmoBridge)
    this.listener = (id, tdata) => this.onSphereMoved(id, tdata.position);
    selection.addObjectChangeListener(this.listener);

    console.log(`[CurveEditor] ${points.length} points Bézier éditables (vert=co, orange=handles). Clic + gizmo translate.`);
  }

  private onSphereMoved(id: string, newPos: THREE.Vector3): void {
    const m = /^curve-(co|hl|hr)-(\d+)$/.exec(id);
    if (!m) return;
    const kind = m[1] as PointKind;
    const idx = Number(m[2]);
    const points = this.data.sentinel_paths.AB.points;
    const p = points[idx];
    if (!p) return;

    if (kind === 'co') {
      // Comme Blender : le point entraîne ses deux poignées
      const dx = newPos.x - p.co[0], dy = newPos.y - p.co[1], dz = newPos.z - p.co[2];
      p.hl = [p.hl[0] + dx, p.hl[1] + dy, p.hl[2] + dz];
      p.hr = [p.hr[0] + dx, p.hr[1] + dy, p.hr[2] + dz];
      this.spheres.get(`curve-hl-${idx}`)?.position.set(...p.hl);
      this.spheres.get(`curve-hr-${idx}`)?.position.set(...p.hr);
    }
    p[kind] = [newPos.x, newPos.y, newPos.z];

    this.rebuild(idx);
  }

  private rebuild(changedIdx: number): void {
    const points = this.data.sentinel_paths.AB.points;
    // Ligne de handles du point modifié
    const line = this.handleLines[changedIdx];
    const p = points[changedIdx];
    if (line && p) {
      line.geometry.setFromPoints([
        new THREE.Vector3(...p.hl), new THREE.Vector3(...p.co), new THREE.Vector3(...p.hr),
      ]);
    }
    // Courbe : reconstruite et poussée dans le système créature
    const curve = buildBezierCurve(points);
    this.curveLine.geometry.setFromPoints(curve.getPoints(CURVE_SAMPLES));
    this.onCurveChange(curve);
  }

  /** Télécharge le JSON complet (points AB modifiés inclus). */
  exportJSON(): void {
    const json = JSON.stringify(this.data, null, 1);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Spaceship_NewV1.1_paths.json';
    a.click();
    URL.revokeObjectURL(a.href);
    console.log('[CurveEditor] JSON exporté — remplace apps/web/public/data/Spaceship_NewV1.1_paths.json');
  }

  dispose(): void {
    this.selection.removeObjectChangeListener(this.listener);
    for (const id of this.registeredIds) this.selection.unregister(id);
    this.registeredIds = [];
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && !Array.isArray(mat)) mat.dispose();
    });
    this.spheres.clear();
    this.handleLines = [];
  }
}
