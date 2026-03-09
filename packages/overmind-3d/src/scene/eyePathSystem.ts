import * as THREE from 'three';
import type { EyePathPoint } from '../machines/timelineMachine.ts';

// ── Constants ────────────────────────────────────────────────────────────────

const SPHERE_RADIUS = 0.08;
const HANDLE_SPHERE_RADIUS = 0.05;
const SPHERE_SEG_W = 8;
const SPHERE_SEG_H = 6;
const CURVE_POINTS = 200;
const CURVE_COLOR = 0xFFEB3B;

const SPHERE_COLOR_DEFAULT  = 0xFFEB3B;  // Yellow
const SPHERE_COLOR_HOVER    = 0xFFA726;  // Orange
const SPHERE_COLOR_SELECTED = 0xFFFFFF;  // White

const HANDLE_COLOR_AUTO    = 0xFFEB3B;  // Yellow
const HANDLE_COLOR_ALIGNED = 0xFF69B4;  // Pink
const HANDLE_COLOR_FREE    = 0x333333;  // Dark
const HANDLE_LINE_COLOR    = 0x888888;

// ── Class ────────────────────────────────────────────────────────────────────

export class EyePathSystem {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private curveLine: THREE.Line | null = null;
  private spheres: Map<number, THREE.Mesh> = new Map();
  private handleSpheres: Map<string, THREE.Mesh> = new Map();
  private handleLines: Map<string, THREE.Line> = new Map();
  private originMarkers: THREE.Object3D[] = [];
  private registeredIds: string[] = [];
  private sharedGeo: THREE.SphereGeometry;
  private handleGeo: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'eyePathGroup';
    scene.add(this.group);
    this.sharedGeo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEG_W, SPHERE_SEG_H);
    this.handleGeo = new THREE.SphereGeometry(HANDLE_SPHERE_RADIUS, SPHERE_SEG_W, SPHERE_SEG_H);
  }

  syncFromState(
    points: EyePathPoint[],
    register: (id: string, obj: THREE.Object3D) => void,
    unregister: (id: string) => void,
  ): void {
    // 1. Unregister old selectables
    for (const id of this.registeredIds) unregister(id);
    this.registeredIds = [];

    // Dispose individual materials
    for (const mesh of this.spheres.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    this.spheres.clear();

    for (const mesh of this.handleSpheres.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    this.handleSpheres.clear();

    for (const line of this.handleLines.values()) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.handleLines.clear();

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

    // Dispose origin markers
    this.disposeOriginMarkers();

    if (points.length === 0) return;

    // 2b. Create origin marker at first point (RGB cross + dashed circle)
    this.createOriginMarker(points[0].position);

    // 3. Create spheres at each control point
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

    // 4. Create handle spheres + lines for each point
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const handleType = pt.handleType ?? 'auto';
      const handleColor = handleType === 'auto' ? HANDLE_COLOR_AUTO
        : handleType === 'aligned' ? HANDLE_COLOR_ALIGNED : HANDLE_COLOR_FREE;

      // handleIn (skip for first point — no incoming segment)
      if (i > 0 && pt.handleIn) {
        this.createHandleSphere(i, 'in', pt.handleIn, handleColor, register);
        this.createHandleLine(i, 'in', pt.position, pt.handleIn);
      }
      // handleOut (skip for last point — no outgoing segment)
      if (i < points.length - 1 && pt.handleOut) {
        this.createHandleSphere(i, 'out', pt.handleOut, handleColor, register);
        this.createHandleLine(i, 'out', pt.position, pt.handleOut);
      }
    }

    // 5. Create curve using CurvePath + CubicBezierCurve3
    if (points.length >= 2) {
      const curvePath = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 0; i < points.length - 1; i++) {
        const pos0 = points[i].position;
        const pos1 = points[i + 1].position;
        const hOut = points[i].handleOut;
        const hIn = points[i + 1].handleIn;
        const p0 = new THREE.Vector3(pos0.x, pos0.y, pos0.z);
        const c0 = hOut ? new THREE.Vector3(hOut.x, hOut.y, hOut.z) : p0.clone();
        const p1 = new THREE.Vector3(pos1.x, pos1.y, pos1.z);
        const c1 = hIn ? new THREE.Vector3(hIn.x, hIn.y, hIn.z) : p1.clone();
        curvePath.add(new THREE.CubicBezierCurve3(p0, c0, c1, p1));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePath.getPoints(CURVE_POINTS));
      const lineMat = new THREE.LineBasicMaterial({ color: CURVE_COLOR, transparent: true, opacity: 0.7 });
      this.curveLine = new THREE.Line(lineGeo, lineMat);
      this.group.add(this.curveLine);
    }
  }

  private createHandleSphere(
    index: number, side: 'in' | 'out',
    pos: { x: number; y: number; z: number },
    color: number,
    register: (id: string, obj: THREE.Object3D) => void,
  ): void {
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(this.handleGeo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    const id = `eyeHandle:${index}:${side}`;
    mesh.userData.selectableId = id;
    this.group.add(mesh);
    register(id, mesh);
    this.registeredIds.push(id);
    this.handleSpheres.set(`${index}:${side}`, mesh);
  }

  private createHandleLine(
    index: number, side: 'in' | 'out',
    pointPos: { x: number; y: number; z: number },
    handlePos: { x: number; y: number; z: number },
  ): void {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pointPos.x, pointPos.y, pointPos.z),
      new THREE.Vector3(handlePos.x, handlePos.y, handlePos.z),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: HANDLE_LINE_COLOR, transparent: true, opacity: 0.5,
    });
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.handleLines.set(`${index}:${side}`, line);
  }

  /** Update sphere colors based on selection/hover state. */
  updateColors(selectedIds: Set<string>, hoveredId: string | null, points?: EyePathPoint[]): void {
    // Control point colors
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

    // Handle sphere colors
    for (const [key, mesh] of this.handleSpheres) {
      const [indexStr, side] = key.split(':');
      const id = `eyeHandle:${indexStr}:${side}`;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (selectedIds.has(id)) {
        mat.color.setHex(SPHERE_COLOR_SELECTED);
      } else if (hoveredId === id) {
        mat.color.setHex(SPHERE_COLOR_HOVER);
      } else if (points) {
        const idx = parseInt(indexStr, 10);
        const handleType = points[idx]?.handleType ?? 'auto';
        mat.color.setHex(
          handleType === 'auto' ? HANDLE_COLOR_AUTO
          : handleType === 'aligned' ? HANDLE_COLOR_ALIGNED
          : HANDLE_COLOR_FREE
        );
      }
    }
  }

  ownsId(id: string): boolean {
    return id.startsWith('eyePath:') || id.startsWith('eyeHandle:');
  }

  ownsControlPointId(id: string): boolean {
    return id.startsWith('eyePath:');
  }

  ownsHandleId(id: string): boolean {
    return id.startsWith('eyeHandle:');
  }

  getPointIndexFromId(id: string): number | null {
    if (!id.startsWith('eyePath:')) return null;
    const n = parseInt(id.slice(8), 10);
    return isNaN(n) ? null : n;
  }

  getHandleInfoFromId(id: string): { pointIndex: number; handleSide: 'in' | 'out' } | null {
    if (!id.startsWith('eyeHandle:')) return null;
    const parts = id.split(':');
    if (parts.length !== 3) return null;
    const index = parseInt(parts[1], 10);
    const side = parts[2] as 'in' | 'out';
    if (isNaN(index) || (side !== 'in' && side !== 'out')) return null;
    return { pointIndex: index, handleSide: side };
  }

  getPointPosition(index: number): { x: number; y: number; z: number } | null {
    const sphere = this.spheres.get(index);
    if (!sphere) return null;
    return { x: sphere.position.x, y: sphere.position.y, z: sphere.position.z };
  }

  private createOriginMarker(pos: { x: number; y: number; z: number }): void {
    const L = 0.3; // axis length

    // RGB axes cross
    const axes: [number[], number][] = [
      [[L, 0, 0], 0xff0000],   // X red
      [[0, L, 0], 0x00ff00],   // Y green
      [[0, 0, L], 0x0000ff],   // Z blue
    ];
    for (const [dir, color] of axes) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pos.x - dir[0], pos.y - dir[1], pos.z - dir[2]),
        new THREE.Vector3(pos.x + dir[0], pos.y + dir[1], pos.z + dir[2]),
      ]);
      const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 999;
      this.group.add(line);
      this.originMarkers.push(line);
    }

    // Dashed circle (horizontal)
    const circleRadius = 0.25;
    const circleSegments = 48;
    const circlePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= circleSegments; i++) {
      const a = (i / circleSegments) * Math.PI * 2;
      circlePoints.push(new THREE.Vector3(
        pos.x + Math.cos(a) * circleRadius,
        pos.y,
        pos.z + Math.sin(a) * circleRadius,
      ));
    }
    const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
    const circleMat = new THREE.LineDashedMaterial({
      color: CURVE_COLOR, dashSize: 0.05, gapSize: 0.03,
      transparent: true, opacity: 0.6, depthTest: false,
    });
    const circle = new THREE.Line(circleGeo, circleMat);
    circle.computeLineDistances();
    circle.renderOrder = 999;
    this.group.add(circle);
    this.originMarkers.push(circle);
  }

  private disposeOriginMarkers(): void {
    for (const obj of this.originMarkers) {
      this.group.remove(obj);
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    }
    this.originMarkers = [];
  }

  dispose(): void {
    this.disposeOriginMarkers();
    for (const mesh of this.spheres.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    for (const mesh of this.handleSpheres.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    for (const line of this.handleLines.values()) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
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
    this.handleGeo.dispose();
    this.spheres.clear();
    this.handleSpheres.clear();
    this.handleLines.clear();
    this.registeredIds = [];
  }
}
