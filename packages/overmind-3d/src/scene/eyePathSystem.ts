import * as THREE from 'three';
import type { EyePathPoint } from '../machines/timelineMachine.ts';

const SPHERE_RADIUS = 0.08;
const SPHERE_SEG_W = 8;
const SPHERE_SEG_H = 6;
const CURVE_POINTS = 200;
const CURVE_COLOR = 0xFFEB3B;
const SPHERE_COLOR_DEFAULT  = 0xFFEB3B;  // Jaune
const SPHERE_COLOR_HOVER    = 0xFFA726;  // Orange
const SPHERE_COLOR_SELECTED = 0xFFFFFF;  // Blanc

export class EyePathSystem {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private curveLine: THREE.Line | null = null;
  private spheres: Map<number, THREE.Mesh> = new Map();
  private registeredIds: string[] = [];
  private sharedGeo: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'eyePathGroup';
    scene.add(this.group);
    this.sharedGeo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEG_W, SPHERE_SEG_H);
  }

  syncFromState(
    points: EyePathPoint[],
    register: (id: string, obj: THREE.Object3D) => void,
    unregister: (id: string) => void,
  ): void {
    // 1. Unregister old spheres
    for (const id of this.registeredIds) unregister(id);
    this.registeredIds = [];

    // Dispose individual materials before clearing
    for (const mesh of this.spheres.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    this.spheres.clear();

    // 2. Clear group children
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    this.curveLine = null;

    if (points.length === 0) return;

    // 3. Create spheres at each control point (individual materials for color changes)
    for (let i = 0; i < points.length; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: SPHERE_COLOR_DEFAULT });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.position.set(points[i].position.x, points[i].position.y, points[i].position.z);
      const id = `eyePath:${i}`;
      mesh.userData.selectableId = id;
      this.group.add(mesh);
      register(id, mesh);
      this.registeredIds.push(id);
      this.spheres.set(i, mesh);
    }

    // 4. Create curve if >= 2 points
    if (points.length >= 2) {
      const vectors = points.map(p => new THREE.Vector3(p.position.x, p.position.y, p.position.z));
      const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.5);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(CURVE_POINTS));
      const lineMat = new THREE.LineBasicMaterial({ color: CURVE_COLOR, transparent: true, opacity: 0.7 });
      this.curveLine = new THREE.Line(lineGeo, lineMat);
      this.group.add(this.curveLine);
    }
  }

  /** Update sphere colors based on selection/hover state. */
  updateColors(selectedIds: Set<string>, hoveredId: string | null): void {
    for (const [idx, mesh] of this.spheres) {
      const id = `eyePath:${idx}`;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (selectedIds.has(id)) {
        mat.color.setHex(SPHERE_COLOR_SELECTED);
      } else if (hoveredId === id) {
        mat.color.setHex(SPHERE_COLOR_HOVER);
      } else {
        mat.color.setHex(SPHERE_COLOR_DEFAULT);
      }
    }
  }

  ownsId(id: string): boolean {
    return id.startsWith('eyePath:');
  }

  getPointIndexFromId(id: string): number | null {
    if (!id.startsWith('eyePath:')) return null;
    const n = parseInt(id.slice(8), 10);
    return isNaN(n) ? null : n;
  }

  getPointPosition(index: number): { x: number; y: number; z: number } | null {
    const sphere = this.spheres.get(index);
    if (!sphere) return null;
    return { x: sphere.position.x, y: sphere.position.y, z: sphere.position.z };
  }

  dispose(): void {
    for (const mesh of this.spheres.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    this.scene.remove(this.group);
    this.sharedGeo.dispose();
    this.spheres.clear();
    this.registeredIds = [];
  }
}
