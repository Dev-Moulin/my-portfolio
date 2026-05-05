import * as THREE from 'three';

// ── Card Noise System ───────────────────────────────────────────────────────
//
// Anime en position XYZ (subtilement) un set explicite de meshes appartenant
// aux 3 cards (Card1, Card2, Card3 dans Blender). Note : les COLLECTIONS
// Blender ne sont PAS exportées comme nodes dans le glTF par défaut, donc on
// ne peut pas faire `getObjectByName('Card1')`. À la place on liste les noms
// de meshes attendus (sans les "." que Blender supprime à l'export).
//
// Équivalent du modificateur Noise dans Blender (sur F-Curves position) :
//   pos.x = baseX + noise(time, seedX) * amplitude
// Chaque mesh a 3 seeds différents (un par axe) pour des oscillations
// indépendantes, comme Blender par défaut.
// ────────────────────────────────────────────────────────────────────────────

/** Set explicite des noms de meshes à animer (sans les "." Blender).
 *  Pour ajouter de nouveaux cubes : ajoute simplement leur nom ici.
 *  Le système log au démarrage les noms attendus mais absents (futurs ajouts). */
const INCLUDED_NAMES = new Set<string>([
  // ── Card1 ──
  'Cube001_gameasset001',
  'Cube002_gameasset001',
  'Cube003_gameasset',
  'Cube004_gameasset001',
  'Cube005_gameasset',
  'Cube006_gameasset',
  'Cube007_gameasset',
  // Futurs (pas encore exportés du Blender) :
  'Cube003',
  'Cube006',
  'Cube007',
  'Cube008',

  // ── Card2 ──
  'Cube001_gameasset002',
  'Cube002_gameasset002',
  'Cube004_gameasset002',
  'Cube005_gameasset001',
  'Cube006_gameasset001',
  'Cube007_gameasset001',

  // ── Card3 ──
  'Cube001_gameasset004',
  'Cube002_gameasset004',
  'Cube003_gameasset001',
  'Cube003_gameasset003',
  'Cube004_gameasset004',
  'Cube005_gameasset003',
  'Cube006_gameasset003',
  'Cube007_gameasset003',
]);

// ── Réglages (ajuste ici pour rendre plus/moins subtil) ─────────────────────
const NOISE_AMPLITUDE = 0.1;   // amplitude max de l'oscillation (unités locales)
const NOISE_SPEED = 0.5;        // vitesse globale du noise (1 = baseline)

interface NoiseTarget {
  mesh: THREE.Object3D;
  baseX: number;
  baseY: number;
  baseZ: number;
  seedX: number;
  seedY: number;
  seedZ: number;
}

/** Multi-sine noise — somme de 3 sinusoïdes à fréquences premières.
 *  Donne un signal pseudo-aléatoire borné dans [-1, 1] (approx). */
function noiseValue(time: number, seed: number): number {
  return (
    Math.sin(time * 0.7  + seed)        * 0.5 +
    Math.sin(time * 1.9  + seed * 2.3)  * 0.3 +
    Math.sin(time * 3.7  + seed * 4.1)  * 0.2
  );
}

export class CardNoiseSystem {
  private targets: NoiseTarget[] = [];
  private time = 0;
  amplitude = NOISE_AMPLITUDE;
  speed = NOISE_SPEED;
  enabled = true;

  constructor(model: THREE.Object3D) {
    this.collect(model);
  }

  private collect(model: THREE.Object3D): void {
    const found: string[] = [];
    const seen = new Set<string>(); // pour identifier ce qui n'a PAS matché

    model.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      if (!INCLUDED_NAMES.has(obj.name)) return;
      if (seen.has(obj.name)) return; // évite doublons si plusieurs noeuds homonymes
      seen.add(obj.name);

      this.targets.push({
        mesh: obj,
        baseX: obj.position.x,
        baseY: obj.position.y,
        baseZ: obj.position.z,
        seedX: Math.random() * 1000,
        seedY: Math.random() * 1000,
        seedZ: Math.random() * 1000,
      });
      found.push(obj.name);
    });

    // Liste les noms attendus mais introuvables (utile quand tu ajoutes
    // de nouveaux Cubes dans Blender → tu vois ici lesquels ne sont pas exportés)
    const missing = [...INCLUDED_NAMES].filter(n => !seen.has(n));

    console.log(`[cardNoise] ${this.targets.length} meshes animées`, { found, missing });
  }

  update(delta: number): void {
    if (!this.enabled || this.targets.length === 0) return;
    this.time += delta * this.speed;
    const a = this.amplitude;
    for (const t of this.targets) {
      t.mesh.position.x = t.baseX + noiseValue(this.time, t.seedX) * a;
      t.mesh.position.y = t.baseY + noiseValue(this.time, t.seedY) * a;
      t.mesh.position.z = t.baseZ + noiseValue(this.time, t.seedZ) * a;
    }
  }

  setAmplitude(a: number): void {
    this.amplitude = a;
  }

  setEnabled(b: boolean): void {
    this.enabled = b;
    if (!b) this.restoreBasePositions();
  }

  private restoreBasePositions(): void {
    for (const t of this.targets) {
      t.mesh.position.set(t.baseX, t.baseY, t.baseZ);
    }
  }

  dispose(): void {
    this.restoreBasePositions();
    this.targets = [];
  }
}
