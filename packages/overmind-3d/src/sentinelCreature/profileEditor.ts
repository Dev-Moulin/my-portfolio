import * as THREE from 'three';
import type { ABMotionProfile } from './abMotionProfile.ts';
import type { SelectionSystem } from '../scene/selectionSystem.ts';

/**
 * SentinelProfileEditor — édition isolée d'une PORTION du profil baké AB (par défaut les
 * frames 238-282, là où la sentinelle rentre dans le vaisseau).
 *
 * Contrairement à l'éditeur de courbe Bézier (qui modifiait `this.curve`, inutilisée quand
 * le profil est chargé), celui-ci édite directement les positions par frame du profil
 * (`profile.pos[frame-frameStart]`, espace GLB-local) → effet immédiat sur le mouvement AB.
 *
 * On pose N poignées vertes déplaçables (gizmo G) le long du segment + 2 bornes rouges
 * ANCRÉES aux extrémités. Déplacer une poignée applique un offset interpolé en smoothstep
 * sur les frames voisines, qui retombe à zéro aux bornes → déformation douce, sans cassure
 * avec le reste du tracé. Le tout vit dans un Group enfant du model (positions locales =
 * coords GLB, aucune conversion).
 */

const HANDLE_RADIUS = 0.8;     // unités GLB (×0.25 par le scale du model)
const HANDLE_COLOR = 0x33ff66; // vert = poignée déplaçable
const PIN_COLOR = 0xff4466;    // rouge = borne ancrée (info, non déplaçable)
const SEG_COLOR = 0xffcc00;    // segment édité (jaune)
const N_HANDLES = 5;           // poignées internes déplaçables

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export class SentinelProfileEditor {
  private profile: ABMotionProfile;
  private selection: SelectionSystem;
  private group = new THREE.Group();
  private listener: (id: string, d: { position: THREE.Vector3 }) => void;
  private registeredIds: string[] = [];

  private frameStart: number;
  private frameEnd: number;
  private idxStart: number;            // index dans profile.pos pour frameStart
  private segLen: number;
  private origSeg: THREE.Vector3[] = []; // positions ORIGINALES du segment (clones)

  // Nœuds de contrôle (bornes ancrées incluses), en param s ∈ [0,1] le long du segment
  private ctrlS: number[] = [];
  private ctrlLocalIdx: number[] = [];     // index local (0..segLen-1) du nœud
  private ctrlOffset: THREE.Vector3[] = []; // offset courant (toujours 0 pour les bornes)
  private handleMeshes: (THREE.Mesh | undefined)[] = []; // mesh par nœud (undefined = borne ancrée)
  private segLine: THREE.Line;

  constructor(
    model: THREE.Object3D,
    profile: ABMotionProfile,
    selection: SelectionSystem,
    frameStart = 238,
    frameEnd = 282,
    anchorEnd = true, // false → la borne de FIN est déplaçable (édition de l'arrivée AB)
  ) {
    this.profile = profile;
    this.selection = selection;
    this.frameStart = frameStart;
    this.frameEnd = frameEnd;
    this.group.name = 'SentinelProfileEditor';
    model.add(this.group);

    this.idxStart = frameStart - profile.frameStart;
    const idxEnd = Math.min(frameEnd - profile.frameStart, profile.pos.length - 1);
    this.segLen = idxEnd - this.idxStart + 1;
    for (let i = 0; i < this.segLen; i++) this.origSeg.push(profile.pos[this.idxStart + i].clone());

    // Nœuds : 2 bornes ancrées + N_HANDLES poignées internes déplaçables
    const totalNodes = N_HANDLES + 2;
    const handleGeo = new THREE.SphereGeometry(HANDLE_RADIUS, 12, 8);
    for (let k = 0; k < totalNodes; k++) {
      const s = k / (totalNodes - 1);
      const localIdx = Math.round(s * (this.segLen - 1));
      // Début toujours ancré (continuité avec le tracé précédent). Fin ancrée sauf en mode
      // arrivée (anchorEnd=false) → on peut alors déplacer le point d'arrivée.
      const movable = k > 0 && (k < totalNodes - 1 || !anchorEnd);
      this.ctrlS.push(s);
      this.ctrlLocalIdx.push(localIdx);
      this.ctrlOffset.push(new THREE.Vector3());

      const mesh = new THREE.Mesh(
        handleGeo,
        new THREE.MeshBasicMaterial({ color: movable ? HANDLE_COLOR : PIN_COLOR, depthTest: false }),
      );
      mesh.renderOrder = 999;
      mesh.position.copy(profile.pos[this.idxStart + localIdx]);
      this.group.add(mesh);
      this.handleMeshes.push(movable ? mesh : undefined);
      if (movable) {
        mesh.name = `profile-handle-${k}`;
        mesh.userData.selectableId = mesh.name; // sinon le clic remonte au vaisseau parent
        selection.register(mesh.name, mesh);
        this.registeredIds.push(mesh.name);
      }
    }

    // Polyline du segment édité (positions courantes)
    const segPts: THREE.Vector3[] = [];
    for (let i = 0; i < this.segLen; i++) segPts.push(profile.pos[this.idxStart + i].clone());
    this.segLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(segPts),
      new THREE.LineBasicMaterial({ color: SEG_COLOR, depthTest: false }),
    );
    this.segLine.renderOrder = 998;
    this.group.add(this.segLine);

    this.listener = (id) => this.onHandleMoved(id);
    selection.addObjectChangeListener(this.listener);
    // Les poignées sont DANS la coque (la sentinelle y rentre) → pick prioritaire pour
    // qu'un clic vise la poignée et pas le vaisseau devant.
    selection.setPriorityPick(this.registeredIds);

    console.log(`[ProfileEditor] frames ${frameStart}-${frameEnd} (${this.segLen} frames) — ${N_HANDLES} poignées vertes (clic + G) ${anchorEnd ? '+ bornes ancrées' : '+ FIN déplaçable (arrivée)'}.`);
  }

  private onHandleMoved(id: string): void {
    // On ne réagit qu'aux changements de NOS poignées (ignore les autres objets de la scène).
    if (!/^profile-handle-\d+$/.test(id)) return;
    // Resynchronise TOUTES les poignées depuis leurs positions réelles. En déplacement GROUPÉ,
    // le grab/gizmo bouge les poignées secondaires sans notifier l'éditeur ; comme elles sont
    // déjà déplacées au moment où la primaire notifie, on relit tout d'un coup → toutes suivent.
    for (let k = 0; k < this.handleMeshes.length; k++) {
      const mesh = this.handleMeshes[k];
      if (!mesh) continue;
      this.ctrlOffset[k].copy(mesh.position).sub(this.origSeg[this.ctrlLocalIdx[k]]);
    }
    this.recompute();
  }

  /** Recalcule les positions du segment = original + offset interpolé (smoothstep) entre nœuds. */
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
      const orig = this.origSeg[i];
      this.profile.pos[this.idxStart + i].set(
        orig.x + o0.x + (o1.x - o0.x) * w,
        orig.y + o0.y + (o1.y - o0.y) * w,
        orig.z + o0.z + (o1.z - o0.z) * w,
      );
    }
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < this.segLen; i++) pts.push(this.profile.pos[this.idxStart + i].clone());
    this.segLine.geometry.setFromPoints(pts);
  }

  /** Log dans la console les positions corrigées de la zone (à copier → je fige dans le JSON). */
  exportJSON(): void {
    const posThree: [number, number, number][] = [];
    for (let i = 0; i < this.segLen; i++) {
      const p = this.profile.pos[this.idxStart + i];
      posThree.push([+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)]);
    }
    const out = { frameStart: this.frameStart, frameEnd: this.frameEnd, pos_three: posThree };
    console.log('[ProfileEditor] zone éditée:', JSON.stringify(out));
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
