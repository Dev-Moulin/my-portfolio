import * as THREE from 'three';

/**
 * DownloadLogoSystem — rejoue en JS l'animation du logo « download » de Card1 (l'anim
 * n'est PAS exportée dans le GLB : géométrie en pose de repos seulement).
 *
 * Spec (THREEJS_Cartes_Logos_Download.md) : boucle 63 frames @ 24 fps = 2.625 s.
 *  - Download_Arrow : rebond vertical (Y local) + squash&stretch (scale, base ~1.3,1,1)
 *    + spin vertical 720° (Y local, linéaire) + « bourrelet » à l'impact (flavor).
 *  - Ring_Spinner   : rotation -360°/boucle (Z local, linéaire) → entraîne Ring_Arrow_1/2/3.
 * On travaille en ESPACE LOCAL (le logo est incliné sur la carte). Valeurs relatives aux
 * transforms de base capturés au chargement.
 */

const LOOP_SECONDS = 2.625;

// Rebond vertical (offset Y local) — §2.3a
const BOB: [number, number][] = [
  [0.00, 0.00], [0.11, 0.04], [0.39, -0.22], [0.45, -0.45],
  [0.46, -0.40], [0.58, -0.40], [0.63, -0.11], [0.84, 0.02], [1.00, 0.00],
];
// Squash & stretch (sx=sy, sz) — §2.3b
const SQUASH: [number, number, number][] = [
  [0.00, 1.00, 1.00], [0.11, 0.94, 1.12], [0.39, 0.86, 1.26], [0.45, 0.82, 1.34],
  [0.52, 1.80, 0.26], [0.57, 1.55, 0.40], [0.63, 0.88, 1.18], [0.84, 1.04, 0.96], [1.00, 1.00, 1.00],
];
// Bourrelet à l'impact (flavor) — §2.3d
const BULGE: [number, number][] = [
  [0.00, 0.00], [0.45, 0.00], [0.52, 0.65], [0.57, 0.35], [0.63, 0.00], [1.00, 0.00],
];

/** Interpolation linéaire d'une table [(t, v)] triée. */
function lerp1(table: [number, number][], t: number): number {
  if (t <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, v0] = table[i];
    const [t1, v1] = table[i + 1];
    if (t >= t0 && t <= t1) return v0 + (v1 - v0) * (t1 > t0 ? (t - t0) / (t1 - t0) : 0);
  }
  return last[1];
}

export class DownloadLogoSystem {
  private arrow: THREE.Object3D | null;
  private ring: THREE.Object3D | null;
  private elapsed = 0;

  private baseArrowPosY = 0;
  private baseArrowScale = new THREE.Vector3(1, 1, 1);
  private baseArrowRotY = 0;
  private baseRingRotZ = 0;

  constructor(model: THREE.Object3D) {
    const find = (name: string) =>
      model.getObjectByName(name) ?? model.getObjectByName(name.replace(/\./g, '')) ?? null;
    this.arrow = find('Download_Arrow');
    this.ring = find('Ring_Spinner');

    if (this.arrow) {
      this.baseArrowPosY = this.arrow.position.y;
      this.baseArrowScale.copy(this.arrow.scale); // ~ (1.3, 1, 1)
      this.baseArrowRotY = this.arrow.rotation.y;
    }
    if (this.ring) this.baseRingRotZ = this.ring.rotation.z;

    console.log(`[downloadLogo] arrow=${!!this.arrow} ring=${!!this.ring} (baseScale=${this.baseArrowScale.x.toFixed(2)},${this.baseArrowScale.y.toFixed(2)},${this.baseArrowScale.z.toFixed(2)})`);
  }

  hasLogo(): boolean { return this.arrow !== null; }

  update(delta: number): void {
    if (!this.arrow) return;
    this.elapsed += delta;
    const t = (this.elapsed % LOOP_SECONDS) / LOOP_SECONDS;

    const bob = lerp1(BOB, t);
    const sx = lerp1(SQUASH.map((r) => [r[0], r[1]]) as [number, number][], t);
    const sz = lerp1(SQUASH.map((r) => [r[0], r[2]]) as [number, number][], t);
    const bulge = lerp1(BULGE, t);
    // Bourrelet : au pic d'écrasement, la matière déborde sur les CÔTÉS (X élargi) et
    // regonfle un peu l'ÉPAISSEUR (Z) → lecture "ça se comprime et bourrelette", pas un
    // simple grossissement uniforme. (Y inchangé = pas plus haut.)
    const bx = 1 + bulge * 0.35;
    const bz = 1 + bulge * 0.8;

    // Flèche : rebond (Y local), squash (sx=sy / sz) + bourrelet, spin 720° (Y local)
    this.arrow.position.y = this.baseArrowPosY + bob;
    this.arrow.scale.set(
      this.baseArrowScale.x * sx * bx,
      this.baseArrowScale.y * sx,
      this.baseArrowScale.z * sz * bz,
    );
    this.arrow.rotation.y = this.baseArrowRotY + t * Math.PI * 4;

    // Cercle : rotation +360°/boucle (Z local) — sens inversé (demande utilisateur)
    if (this.ring) this.ring.rotation.z = this.baseRingRotZ + t * Math.PI * 2;
  }

  dispose(): void {
    // Restaure la pose de repos (frame 1)
    if (this.arrow) {
      this.arrow.position.y = this.baseArrowPosY;
      this.arrow.scale.copy(this.baseArrowScale);
      this.arrow.rotation.y = this.baseArrowRotY;
    }
    if (this.ring) this.ring.rotation.z = this.baseRingRotZ;
  }
}
