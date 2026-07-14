import * as THREE from 'three';
import type { SelectionSystem } from './selectionSystem.ts';
import type { CameraABOffset } from './scrollCameraAnimator.ts';

/**
 * CameraPathEditor — édition « à la Blender » d'une PORTION de la trajectoire caméra AB
 * (par défaut frames 53→260). Comme la caméra est pilotée par le clip du GLB, on n'édite
 * pas des positions mais un OFFSET de position par frame (monde), ajouté à la pose du clip
 * pendant AB (orientation/FOV du clip conservées). Offset = 0 par défaut → aucun changement.
 *
 * Poignées bleues déplaçables (gizmo G) + 2 bornes rouges ancrées aux extrémités ; la
 * déformation (smoothstep) retombe à zéro aux bornes → raccord sans cassure. Tout vit dans
 * un Group enfant de la SCÈNE (espace monde) → positions locales = monde, le grab marche
 * nativement. Les offsets sont poussés en live dans l'animateur (setCameraABOffset).
 */

const HANDLE_RADIUS = 0.6;     // unités MONDE
const HANDLE_COLOR = 0x33aaff; // bleu = poignée déplaçable
const PIN_COLOR = 0xff4466;    // rouge = borne ancrée
const PATH_COLOR = 0xffcc00;   // tracé édité (jaune)
const N_HANDLES = 6;           // poignées internes déplaçables

interface ABSample { f: number; pos_three: [number, number, number] }

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export class CameraPathEditor {
  private selection: SelectionSystem;
  private onChange: (d: CameraABOffset) => void;
  private group = new THREE.Group();
  private listener: (id: string, d: { position: THREE.Vector3 }) => void;
  private registeredIds: string[] = [];

  private fStart: number;
  private fEnd: number;
  private segLen: number;
  private origWorld: THREE.Vector3[] = []; // pos caméra MONDE par frame entière
  private offsets: number[][] = [];        // offset MONDE par frame (départ 0)

  private ctrlS: number[] = [];
  private ctrlLocalIdx: number[] = [];
  private ctrlOffset: THREE.Vector3[] = [];
  private pathLine: THREE.Line;

  constructor(
    scene: THREE.Scene,
    model: THREE.Object3D,
    abSamples: ABSample[],
    selection: SelectionSystem,
    onChange: (d: CameraABOffset) => void,
    initial: CameraABOffset | null = null,
    fStart = 53,
    fEnd = 260,
  ) {
    this.selection = selection;
    this.onChange = onChange;
    this.fStart = fStart;
    this.fEnd = fEnd;
    this.group.name = 'CameraPathEditor';
    scene.add(this.group); // espace monde

    model.updateWorldMatrix(true, false);
    this.segLen = fEnd - fStart + 1;
    const sorted = abSamples.slice().sort((a, b) => a.f - b.f);
    const seed = initial && initial.fStart === fStart && initial.fEnd === fEnd
      && initial.offsets.length === this.segLen ? initial.offsets : null;
    for (let i = 0; i < this.segLen; i++) {
      const p = this.sampleAt(sorted, fStart + i); // pos_three GLB-local
      const w = new THREE.Vector3(p[0], p[1], p[2]);
      model.localToWorld(w);
      this.origWorld.push(w);
      this.offsets.push(seed ? [seed[i][0], seed[i][1], seed[i][2]] : [0, 0, 0]);
    }

    // Nœuds : 2 bornes ancrées + N_HANDLES poignées internes déplaçables
    const totalNodes = N_HANDLES + 2;
    const handleGeo = new THREE.SphereGeometry(HANDLE_RADIUS, 12, 8);
    for (let k = 0; k < totalNodes; k++) {
      const s = k / (totalNodes - 1);
      const localIdx = Math.round(s * (this.segLen - 1));
      const movable = k > 0 && k < totalNodes - 1;
      const off = seed ? new THREE.Vector3(...seed[localIdx]) : new THREE.Vector3();
      this.ctrlS.push(s);
      this.ctrlLocalIdx.push(localIdx);
      this.ctrlOffset.push(off);

      const mesh = new THREE.Mesh(
        handleGeo,
        new THREE.MeshBasicMaterial({ color: movable ? HANDLE_COLOR : PIN_COLOR, depthTest: false }),
      );
      mesh.renderOrder = 999;
      mesh.position.copy(this.origWorld[localIdx]).add(off);
      this.group.add(mesh);
      if (movable) {
        mesh.name = `camera-handle-${k}`;
        mesh.userData.selectableId = mesh.name;
        selection.register(mesh.name, mesh);
        this.registeredIds.push(mesh.name);
      }
    }

    this.pathLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(this.origWorld.map((v) => v.clone())),
      new THREE.LineBasicMaterial({ color: PATH_COLOR, depthTest: false }),
    );
    this.pathLine.renderOrder = 998;
    this.group.add(this.pathLine);

    this.listener = (id, d) => this.onHandleMoved(id, d.position);
    selection.addObjectChangeListener(this.listener);
    selection.setPriorityPick(this.registeredIds);
    if (seed) this.recompute(); else this.pushOffsets();

    console.log(`[CameraPathEditor] AB caméra frames ${fStart}-${fEnd} (${this.segLen}) — ${N_HANDLES} poignées bleues (clic + G), bornes rouges ancrées.`);
  }

  /** pos_three interpolée à la frame f depuis les échantillons (pas de 2). */
  private sampleAt(sorted: ABSample[], f: number): [number, number, number] {
    if (f <= sorted[0].f) return sorted[0].pos_three;
    const last = sorted[sorted.length - 1];
    if (f >= last.f) return last.pos_three;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (f >= a.f && f <= b.f) {
        const t = (f - a.f) / (b.f - a.f);
        return [
          a.pos_three[0] + (b.pos_three[0] - a.pos_three[0]) * t,
          a.pos_three[1] + (b.pos_three[1] - a.pos_three[1]) * t,
          a.pos_three[2] + (b.pos_three[2] - a.pos_three[2]) * t,
        ];
      }
    }
    return last.pos_three;
  }

  private onHandleMoved(id: string, newPos: THREE.Vector3): void {
    const m = /^camera-handle-(\d+)$/.exec(id);
    if (!m) return;
    const k = Number(m[1]);
    this.ctrlOffset[k].copy(newPos).sub(this.origWorld[this.ctrlLocalIdx[k]]);
    this.recompute();
  }

  private recompute(): void {
    for (let i = 0; i < this.segLen; i++) {
      const s = this.segLen > 1 ? i / (this.segLen - 1) : 0;
      let k = 0;
      while (k < this.ctrlS.length - 2 && this.ctrlS[k + 1] < s) k++;
      const s0 = this.ctrlS[k];
      const s1 = this.ctrlS[k + 1];
      const w = smoothstep(s1 > s0 ? (s - s0) / (s1 - s0) : 0);
      const o0 = this.ctrlOffset[k];
      const o1 = this.ctrlOffset[k + 1];
      this.offsets[i] = [o0.x + (o1.x - o0.x) * w, o0.y + (o1.y - o0.y) * w, o0.z + (o1.z - o0.z) * w];
    }
    const pts: THREE.Vector3[] = this.origWorld.map((v, i) =>
      new THREE.Vector3(v.x + this.offsets[i][0], v.y + this.offsets[i][1], v.z + this.offsets[i][2]));
    this.pathLine.geometry.setFromPoints(pts);
    this.pushOffsets();
  }

  private rounded(): number[][] {
    return this.offsets.map((o) => [+o[0].toFixed(4), +o[1].toFixed(4), +o[2].toFixed(4)]);
  }

  private pushOffsets(): void {
    this.onChange({ fStart: this.fStart, fEnd: this.fEnd, offsets: this.rounded() });
  }

  exportJSON(): void {
    console.log('[CameraPathEditor] offsets AB:', JSON.stringify({ fStart: this.fStart, fEnd: this.fEnd, offsets: this.rounded() }));
  }

  dispose(): void {
    this.selection.removeObjectChangeListener(this.listener);
    this.selection.setPriorityPick(null);
    for (const id of this.registeredIds) this.selection.unregister(id);
    this.registeredIds = [];
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const me = o as THREE.Mesh;
      me.geometry?.dispose?.();
      const mat = (me as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && !Array.isArray(mat)) mat.dispose();
    });
  }
}
