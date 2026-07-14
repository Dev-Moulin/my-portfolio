import * as THREE from 'three';

// ── Circuit fermé pour les mini-vaisseaux ────────────────────────────────────
//
// Les mini-vaisseaux CIRCULENT en boucle FERMÉE le long d'une courbe de Bézier cyclique
// livrée par Blender (`Circuit_Particules_boucle.json`). Coords dans le MÊME espace que le
// GLB (local model) → converties en monde via `model.matrixWorld`. N vaisseaux avancent à
// vitesse MONDE (reparamétrage par longueur d'arc → getPointAt/getTangentAt), orientés sur
// la tangente.
//
// ILLUSION « flux linéaire » : l'utilisateur ne doit PAS voir les demi-tours aux extrémités
// (sinon il comprend que c'est une boucle). On fait donc DISPARAÎTRE les vaisseaux (fondu
// scale→0) dès qu'ils approchent une extrémité (|Z local| > fadeStart), invisibles pendant
// tout le demi-tour (|Z| > fadeEnd), puis ils RÉAPPARAISSENT en repartant.
//
// VIE / MOUVEMENT (4 leviers indépendants, chacun réglable) — casse la « file indienne » :
//   A. Dispersion — jitter de position sur le rail (cloche) + légère variation de vitesse
//      par vaisseau (dépassements) → plus « file à intervalle régulier ».
//   B. Voies      — décalage latéral+vertical FIXE par vaisseau (essaim autour du rail).
//   C. Houle      — oscillation latérale/verticale animée (zigzag, monte-descend), bornée.
//   D. Vrilles    — roll autour de l'axe de marche pour une FRACTION des vaisseaux (tonneaux,
//      sens ±, N tours sur le trajet).
// Chaque vaisseau tire des GRAINES aléatoires FIXES à sa création ; les AMPLITUDES globales
// sont réglables en live sans re-tirer l'aléa. B/C sont bornés → « rester dans la trajectoire »
// (pas de collision avec les cartes/mèches — pas de détection, on borne l'amplitude à l'œil).

interface ShipCircuitConfig {
  count: number;        // nombre de vaisseaux sur la boucle (densité)
  shipScale: number;    // taille de chaque vaisseau
  speed: number;        // vitesse MONDE (u/s) le long de la courbe
  fadeStart: number;    // |Z local| où le fondu de disparition COMMENCE
  fadeEnd: number;      // |Z local| au-delà duquel le vaisseau est totalement caché
  // ── Vie / mouvement ──
  spread: number;       // A: amplitude du jitter d'espacement (0..1 = fraction de la demi-case)
  speedVar: number;     // A: variation de vitesse individuelle (0..1 = ±fraction)
  laneAmp: number;      // B: amplitude du décalage latéral/vertical fixe (unités locales)
  swayAmp: number;      // C: amplitude de la houle (unités locales)
  swayFreq: number;     // C: fréquence temporelle de la houle
  rollFraction: number; // D: fraction de vaisseaux qui vrillent (0..1)
  bank: number;         // E: force de l'inclinaison type drone/drift en virage (0..1)
  // ── Circuits multiples ──
  circuits: number;       // nombre de boucles (copies de la boucle de base, tournées autour de Z)
  circuitAngleDeg: number;// angle max (°) autour de l'axe Z ; les boucles vont de -angle à +angle
}

const DEFAULT_CONFIG: ShipCircuitConfig = {
  count: 114,           // vaisseaux PAR boucle (réglé à l'œil par Paul)
  shipScale: 0.15,
  speed: 7,
  fadeStart: 300, // extrémités du circuit à |Z|≈344-350 (cf. JSON)
  fadeEnd: 340,
  spread: 0.7,
  speedVar: 0,      // 0 par défaut → préserve l'espacement pondéré par taille (pas de dépassement)
  laneAmp: 3,
  swayAmp: 2,
  swayFreq: 1.2,
  rollFraction: 0.18,
  bank: 0.5,
  circuits: 2,          // 2 boucles : +angle et -angle (la boucle d'origine à 0° est masquée)
  circuitAngleDeg: 11,  // rotation autour de l'axe Z (réglé à l'œil par Paul)
};

/** Fichier de la courbe (relatif au basePath de l'app). */
const CURVE_URL = 'data/Circuit_Particules_boucle.json';

/** Cap du nombre de vaisseaux PAR boucle (slider « Nombre »). */
const MAX_SHIPS = 250;

/** Cap du nombre de boucles. */
const MAX_CIRCUITS = 6;

/** Capacité (matrices) de chaque InstancedMesh — couvre le total sur toutes les boucles. */
const MAX_INSTANCES = 900;

/**
 * Angles (°) des boucles autour de l'axe Z : réparties uniformément dans [-angle, +angle].
 *  - 1 boucle  → [0]
 *  - 2 boucles → [-angle, +angle]   (l'origine 0° n'est PAS peuplée = « masquée »)
 *  - 3 boucles → [-angle, 0, +angle]
 */
function computeCircuitAngles(n: number, angleDeg: number): number[] {
  if (n <= 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(-angleDeg + (i * 2 * angleDeg) / (n - 1));
  return out;
}

/** Nombre d'oscillations SPATIALES de la houle sur un tour complet de circuit. */
// Houle INDIVIDUELLE : chaque vaisseau ondule à SA fréquence/phase/amplitude propre (latéral
// et vertical indépendants) → trajectoires décorrélées, pas une onde commune. Fréquences
// tirées en continu dans [MIN,MAX] → non-commensurables → mouvement non répétitif (comme
// l'idle « vivote » de la Sentinelle).
const SWAY_FREQ_MIN = 0.25;
const SWAY_FREQ_MAX = 1.6;

// Banking (inclinaison type drone / drift de la Sentinelle) — même esprit que
// SentinelCreatureSystem : incline autour de l'axe de vol selon le virage, borné + lissé.
// Ici le virage visible vient de la HOULE (le rail est droit sur les portions visibles) →
// l'inclinaison suit l'angle de biais latéral (vitesse latérale / vitesse longitudinale).
const BANK_MAX = Math.PI / 4;  // inclinaison max (~45°)
const BANK_SMOOTH = 0.1;       // lissage exponentiel (comme BANK_SMOOTH Sentinelle)
const BANK_GAIN_REF = 10;      // gain de référence (× slider bank 0..1)

const TAU = Math.PI * 2;
const UP_LOCAL = new THREE.Vector3(0, 1, 0);

// Templates mini-vaisseaux : meshes Cube*/Plane* GARÉS loin sur le côté (X≈175 ou Z≈330
// en local). Le même motif matche les greebles de cartes (près de X≈-38), d'où le filtre
// de DISTANCE en espace MODEL-LOCAL (robuste au placement/échelle du model).
// NB V2.8.3 : les templates n'ont plus le suffixe `_gameasset` (émetteurs Circle retirés).
const _tplLocal = new THREE.Vector3();
const MINISHIP_MIN_OFFSET = 150;

function isMiniShipTemplate(child: THREE.Object3D, model: THREE.Object3D): boolean {
  if (!(child as THREE.Mesh).isMesh) return false;
  const name = child.name;
  if (!(name.startsWith('Cube') || name.startsWith('Plane'))) return false;
  if (name.endsWith('_gameasset')) return false; // ancien suffixe — plus utilisé en V2.8.3
  child.getWorldPosition(_tplLocal);
  model.worldToLocal(_tplLocal);
  return Math.hypot(_tplLocal.x, _tplLocal.z) > MINISHIP_MIN_OFFSET;
}

/** Tirage triangulaire dans [-1,1], pic central (≈ cloche) : plus de chances proche que loin. */
function bell(): number {
  return Math.random() + Math.random() - 1;
}

// ── Graines par vaisseau (aléatoire FIXE, généré à la création) ──────────────
interface Ship {
  templateIdx: number;
  circuitIdx: number;  // à quelle boucle appartient ce vaisseau (index dans circuitMatrices)
  phase: number;       // position sur le circuit (0..1), avance à vitesse individuelle
  slotWidth: number;   // largeur du créneau ∝ taille (A) — espacement pondéré, borne le jitter
  slotJitter: number;  // [-1,1] cloche — décalage d'espacement live (A)
  speedSeed: number;   // [-1,1] — variation de vitesse (A)
  laneX: number;       // [-1,1] cloche — voie latérale (B)
  laneY: number;       // [-1,1] cloche — voie verticale (B)
  swayFreqLat: number;  // fréquence temporelle latérale propre (C)
  swayPhaseLat: number; // [0,TAU) déphasage latéral propre (C)
  swayAmpLat: number;   // [0,1] amplitude latérale propre — 0 = ne dévie pas latéralement (C)
  swayFreqVert: number; // fréquence temporelle verticale propre (C)
  swayPhaseVert: number;// [0,TAU) déphasage vertical propre (C)
  swayAmpVert: number;  // [0,1] amplitude verticale propre (C)
  rollSeed: number;    // [0,1) — < rollFraction ⇒ ce vaisseau vrille (D)
  rollDirSign: number; // ±1 — sens de vrille (D)
  rollTurns: number;   // 2..5 — nb de tours sur un tour de circuit (D)
  bankSmoothed: number; // état lissé de l'inclinaison (E)
}

// ── Temp (pas d'alloc par frame) ─────────────────────────────────────────────
const _pLocal = new THREE.Vector3();
const _pWorld = new THREE.Vector3();
const _tanLocal = new THREE.Vector3();
const _tanWorld = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _scaleV = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, -1);

// ── Class ────────────────────────────────────────────────────────────────────

export class MiniShipParticleSystem {
  private scene: THREE.Scene;
  private modelMatrix = new THREE.Matrix4();   // local GLB → monde scène (figé au build)
  private modelScale = 1;
  private templates: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  private templateRadius: number[] = [];       // rayon (bounding sphere) de chaque template → taille
  private instancedMeshes: THREE.InstancedMesh[] = [];
  private curve: THREE.CurvePath<THREE.Vector3> | null = null;
  private curveLenLocal = 1;                    // longueur LOCALE (pour la pente latérale du banking)
  private curveLengthWorld = 1;
  // Une matrice local→monde par boucle = modelMatrix × rotation(angle) autour de l'axe Z.
  private circuitMatrices: THREE.Matrix4[] = [];
  private ships: Ship[] = [];
  private time = 0;
  private config: ShipCircuitConfig;
  private ready = false;
  private disposed = false;
  private pathLines: THREE.Line[] = [];        // debug : tracé de chaque boucle

  constructor(model: THREE.Object3D, scene: THREE.Scene, basePath: string, config?: Partial<ShipCircuitConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    model.updateMatrixWorld(true);
    this.modelMatrix.copy(model.matrixWorld);

    const scaleV = new THREE.Vector3();
    model.getWorldScale(scaleV);
    this.modelScale = scaleV.x || 1;

    // ── Extraction des templates de vaisseaux ─────────────────────────────
    const names: string[] = [];
    model.traverse((child) => {
      if (isMiniShipTemplate(child, model)) {
        const mesh = child as THREE.Mesh;
        this.templates.push({ geometry: mesh.geometry, material: mesh.material });
        names.push(mesh.name);
        mesh.visible = false;
      }
    });
    console.log(`[MiniShipParticles] ${this.templates.length} template(s) de vaisseau:`, names);

    if (this.templates.length === 0) {
      console.warn('[MiniShipParticles] aucun template vaisseau trouvé (Cube*/Plane* loin du corps) — circuit non initialisé');
      return;
    }

    fetch(`${basePath}${CURVE_URL}`)
      .then((r) => r.json())
      .then((json) => this.buildCircuit(json))
      .catch((err) => console.warn('[MiniShipParticles] courbe non chargée:', err));
  }

  // ── Build du circuit une fois la courbe reçue ───────────────────────────

  private buildCircuit(json: unknown): void {
    if (this.disposed) return;
    const pts = (json as { bezier_control_points?: Array<{
      co: number[]; handle_left: number[]; handle_right: number[];
    }> })?.bezier_control_points;
    if (!Array.isArray(pts) || pts.length < 2) {
      console.warn('[MiniShipParticles] JSON de courbe invalide (bezier_control_points manquant)');
      return;
    }

    // Bézier cubique cyclique : segment i→i+1 = [co_i, handle_right_i, handle_left_{i+1}, co_{i+1}].
    const curve = new THREE.CurvePath<THREE.Vector3>();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n]; // % → segment de fermeture (dernier → premier)
      curve.add(new THREE.CubicBezierCurve3(
        new THREE.Vector3(a.co[0], a.co[1], a.co[2]),
        new THREE.Vector3(a.handle_right[0], a.handle_right[1], a.handle_right[2]),
        new THREE.Vector3(b.handle_left[0], b.handle_left[1], b.handle_left[2]),
        new THREE.Vector3(b.co[0], b.co[1], b.co[2]),
      ));
    }
    this.curve = curve;
    this.curveLenLocal = curve.getLength();
    this.curveLengthWorld = this.curveLenLocal * this.modelScale;

    // Rayon (taille) de chaque template → espacement pondéré (les gros ont plus d'espace).
    this.templateRadius = this.templates.map((t) => {
      if (!t.geometry.boundingSphere) t.geometry.computeBoundingSphere();
      return t.geometry.boundingSphere?.radius ?? 1;
    });

    for (const tmpl of this.templates) {
      const im = new THREE.InstancedMesh(tmpl.geometry, tmpl.material, MAX_INSTANCES);
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(im);
      this.instancedMeshes.push(im);
    }

    this.rebuildCircuitMatrices();
    this.initShips(this.config.count);
    this.ready = true;
    console.log(
      `[MiniShipParticles] circuit prêt : ${n} pts Bézier, longueur monde≈${this.curveLengthWorld.toFixed(0)}, ` +
      `${this.circuitMatrices.length} boucle(s) (±${this.config.circuitAngleDeg}° autour de Z), ` +
      `${this.ships.length} vaisseaux, fondu |Z| ${this.config.fadeStart}→${this.config.fadeEnd}`,
    );
  }

  /** (Re)calcule une matrice local→monde par boucle : rotation autour de l'axe Z LOCAL (le grand
   *  axe de l'ovale) appliquée AVANT le placement monde du modèle. Rotation autour de Z → n'affecte
   *  pas la coordonnée Z → le fondu aux extrémités reste identique sur toutes les boucles. */
  private rebuildCircuitMatrices(): void {
    const angles = computeCircuitAngles(this.config.circuits, this.config.circuitAngleDeg);
    const rot = new THREE.Matrix4();
    this.circuitMatrices = angles.map((deg) => {
      rot.makeRotationZ((deg * Math.PI) / 180);
      return new THREE.Matrix4().multiplyMatrices(this.modelMatrix, rot);
    });
  }

  /** (Ré)alloue `count` vaisseaux PAR BOUCLE, chacun avec ses graines fixes et un espacement
   *  PONDÉRÉ PAR LA TAILLE (les gros occupent un plus grand créneau → plus d'espace autour). */
  private initShips(count: number): void {
    const perCircuit = Math.max(0, Math.min(count, MAX_SHIPS));
    const nCircuits = Math.max(1, this.circuitMatrices.length);
    const tCount = Math.max(1, this.templates.length);
    this.ships = [];

    for (let ci = 0; ci < nCircuits; ci++) {
      const start = this.ships.length;
      for (let i = 0; i < perCircuit; i++) {
        this.ships.push({
          templateIdx: Math.floor(Math.random() * tCount),
          circuitIdx: ci,
          phase: 0,        // posé plus bas (espacement pondéré)
          slotWidth: 0,    // idem
          slotJitter: bell(),
          speedSeed: Math.random() * 2 - 1,
          laneX: bell(),
          laneY: bell(),
          swayFreqLat: SWAY_FREQ_MIN + Math.random() * (SWAY_FREQ_MAX - SWAY_FREQ_MIN),
          swayPhaseLat: Math.random() * TAU,
          swayAmpLat: Math.random(),            // [0,1] — certains ne dévient pas, d'autres à fond
          swayFreqVert: SWAY_FREQ_MIN + Math.random() * (SWAY_FREQ_MAX - SWAY_FREQ_MIN),
          swayPhaseVert: Math.random() * TAU,
          swayAmpVert: Math.random() * 0.6,     // vertical un peu plus discret
          rollSeed: Math.random(),
          rollDirSign: Math.random() < 0.5 ? -1 : 1,
          rollTurns: 2 + Math.floor(Math.random() * 4),
          bankSmoothed: 0,
        });
      }
      // Espacement pondéré par taille, INDÉPENDANT dans chaque boucle (créneau ∝ rayon ; le jitter
      // spread reste borné à son créneau → pas d'empiètement sur le voisin).
      let total = 0;
      for (let i = 0; i < perCircuit; i++) total += this.templateRadius[this.ships[start + i].templateIdx] ?? 1;
      total = total || 1;
      let acc = 0;
      for (let i = 0; i < perCircuit; i++) {
        const w = (this.templateRadius[this.ships[start + i].templateIdx] ?? 1) / total;
        this.ships[start + i].slotWidth = w;
        this.ships[start + i].phase = (acc + w * 0.5) % 1; // centre du créneau
        acc += w;
      }
    }
  }

  // ── Update (chaque frame) ───────────────────────────────────────────────

  update(delta: number): void {
    if (!this.ready || !this.curve) return;
    this.time += delta;

    const c = this.config;
    const baseStep = this.curveLengthWorld > 0 ? (c.speed * delta) / this.curveLengthWorld : 0;
    const n = this.ships.length;
    const counts = new Array<number>(this.instancedMeshes.length).fill(0);

    for (let i = 0; i < n; i++) {
      const ship = this.ships[i];

      // A. Avance à vitesse individuelle + jitter d'espacement borné au créneau du vaisseau
      //    (live, sans toucher la phase interne).
      const speedMul = 1 + ship.speedSeed * c.speedVar;
      ship.phase = (ship.phase + baseStep * speedMul + 1) % 1;
      const t = (ship.phase + ship.slotJitter * c.spread * ship.slotWidth * 0.5 + 1) % 1;

      this.curve.getPointAt(t, _pLocal);
      const railZ = _pLocal.z; // fondu basé sur la position du RAIL (avant offset)
      this.curve.getTangentAt(t, _tanLocal);

      // Repère perpendiculaire local (côté + haut) le long du rail.
      _side.crossVectors(_tanLocal, UP_LOCAL);
      if (_side.lengthSq() < 1e-8) _side.set(1, 0, 0); // garde-fou (tangente ∥ up)
      _side.normalize();
      _up.crossVectors(_side, _tanLocal).normalize();

      // B. Voie fixe + C. Houle INDIVIDUELLE (chaque vaisseau sa fréquence/phase/amplitude
      //    propre, latéral ≠ vertical) → trajectoires décorrélées, pas une onde commune.
      const aLat = this.time * ship.swayFreqLat * c.swayFreq + ship.swayPhaseLat;
      const aVert = this.time * ship.swayFreqVert * c.swayFreq + ship.swayPhaseVert;
      const offS = ship.laneX * c.laneAmp + Math.sin(aLat) * c.swayAmp * ship.swayAmpLat;
      const offU = ship.laneY * c.laneAmp + Math.sin(aVert) * c.swayAmp * ship.swayAmpVert;
      _pLocal.addScaledVector(_side, offS).addScaledVector(_up, offU);

      const scale = c.shipScale * this.fadeFactor(Math.abs(railZ));
      // Matrice de la boucle du vaisseau (rotation Z autour de l'axe + placement monde).
      const cm = this.circuitMatrices[ship.circuitIdx] ?? this.modelMatrix;
      _pWorld.copy(_pLocal).applyMatrix4(cm);

      // Orientation : avant (-Z) aligné sur la tangente (sens de marche) de sa boucle.
      _tanWorld.copy(_tanLocal).transformDirection(cm);
      _quat.setFromUnitVectors(_forward, _tanWorld);

      // E. Banking (drone/drift) : incline selon l'angle de biais latéral = vitesse latérale
      //    réelle / vitesse longitudinale (le rail est droit sur les portions visibles).
      const vLat = Math.cos(aLat) * ship.swayFreqLat * c.swayFreq * c.swayAmp * ship.swayAmpLat;
      const vLong = this.modelScale > 0 ? c.speed / this.modelScale : c.speed;
      const lateralSlope = vLong > 0.001 ? vLat / vLong : 0;
      const bankTarget = Math.max(-BANK_MAX, Math.min(BANK_MAX, lateralSlope * c.bank * BANK_GAIN_REF));
      ship.bankSmoothed += (bankTarget - ship.bankSmoothed) * BANK_SMOOTH;

      // Roll total autour de l'axe de marche = banking (tous) + D. vrille (fraction).
      let roll = ship.bankSmoothed;
      if (ship.rollSeed < c.rollFraction) roll += ship.rollDirSign * t * ship.rollTurns * TAU;
      if (roll !== 0) {
        _rollQuat.setFromAxisAngle(_tanWorld, roll);
        _quat.premultiply(_rollQuat);
      }

      _mat.compose(_pWorld, _quat, _scaleV.set(scale, scale, scale));

      const ti = ship.templateIdx;
      const im = this.instancedMeshes[ti];
      const idx = counts[ti];
      if (im && idx < im.instanceMatrix.count) {
        im.setMatrixAt(idx, _mat);
        counts[ti] = idx + 1;
      }
    }

    for (let i = 0; i < this.instancedMeshes.length; i++) {
      this.instancedMeshes[i].count = counts[i];
      if (counts[i] > 0) this.instancedMeshes[i].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Facteur d'échelle 0..1 selon |Z local| :
   *  - |Z| ≤ fadeStart          → 1 (visible plein)
   *  - fadeStart < |Z| < fadeEnd → fondu smoothstep 1→0 (disparaît vers l'extrémité)
   *  - |Z| ≥ fadeEnd            → 0 (invisible : demi-tour caché)
   */
  private fadeFactor(absZ: number): number {
    const { fadeStart, fadeEnd } = this.config;
    if (fadeEnd <= fadeStart) return absZ >= fadeEnd ? 0 : 1;
    if (absZ <= fadeStart) return 1;
    if (absZ >= fadeEnd) return 0;
    const u = (fadeEnd - absZ) / (fadeEnd - fadeStart);
    return u * u * (3 - 2 * u); // smoothstep
  }

  // ── Réglages live (DevPanel) ────────────────────────────────────────────

  /** Vitesse de croisière (unités MONDE / s). */
  setSpeed(speed: number): void {
    this.config.speed = Math.max(0, speed);
  }

  /** Densité : nombre de vaisseaux répartis sur la boucle (re-tire les graines). */
  setTargetCount(count: number): void {
    this.config.count = Math.max(0, Math.min(count, MAX_SHIPS));
    if (this.ready) this.initShips(this.config.count);
  }

  /** Taille (échelle) de chaque mini-vaisseau. */
  setShipScale(scale: number): void {
    this.config.shipScale = Math.max(0.01, scale);
  }

  /** Zone de disparition aux extrémités : |Z| début→fin du fondu (cache les demi-tours). */
  setFadeZone(start: number, end: number): void {
    this.config.fadeStart = Math.max(0, start);
    this.config.fadeEnd = Math.max(this.config.fadeStart, end);
  }

  /** Amplitudes des 4 leviers de « vie » (live, sans re-tirer l'aléa par vaisseau). */
  setMotion(m: {
    spread?: number; speedVar?: number; laneAmp?: number;
    swayAmp?: number; swayFreq?: number; rollFraction?: number; bank?: number;
  }): void {
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    if (m.spread !== undefined) this.config.spread = clamp01(m.spread);
    if (m.speedVar !== undefined) this.config.speedVar = clamp01(m.speedVar);
    if (m.laneAmp !== undefined) this.config.laneAmp = Math.max(0, m.laneAmp);
    if (m.swayAmp !== undefined) this.config.swayAmp = Math.max(0, m.swayAmp);
    if (m.swayFreq !== undefined) this.config.swayFreq = Math.max(0, m.swayFreq);
    if (m.rollFraction !== undefined) this.config.rollFraction = clamp01(m.rollFraction);
    if (m.bank !== undefined) this.config.bank = clamp01(m.bank);
  }

  /** Boucles multiples : nombre + angle (°) autour de l'axe Z. Recalcule les matrices et
   *  redistribue les vaisseaux (même nombre par boucle). */
  setCircuits(circuits: number, angleDeg: number): void {
    this.config.circuits = Math.max(1, Math.min(Math.round(circuits), MAX_CIRCUITS));
    this.config.circuitAngleDeg = Math.max(0, angleDeg);
    if (this.ready) {
      this.rebuildCircuitMatrices();
      this.initShips(this.config.count);
      this.rebuildPathLines();
    }
  }

  /** Debug : affiche/masque le tracé de CHAQUE boucle dans la scène. */
  setPathsVisible(visible: boolean): void {
    if (visible && this.pathLines.length === 0) this.rebuildPathLines();
    for (const l of this.pathLines) l.visible = visible;
  }

  /** (Re)construit les lignes de debug (une par boucle). */
  private rebuildPathLines(): void {
    const wasVisible = this.pathLines.length > 0 && this.pathLines[0].visible;
    this.clearPathLines();
    if (!this.curve) return;
    const base = this.curve.getPoints(240);
    for (const cm of this.circuitMatrices) {
      const world = base.map((p) => p.clone().applyMatrix4(cm));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(world),
        new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9, depthTest: false }),
      );
      line.renderOrder = 997;
      line.visible = wasVisible;
      this.scene.add(line);
      this.pathLines.push(line);
    }
  }

  private clearPathLines(): void {
    for (const l of this.pathLines) {
      this.scene.remove(l);
      l.geometry.dispose();
      (l.material as THREE.Material).dispose();
    }
    this.pathLines = [];
  }

  // ── Dispose ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    for (const im of this.instancedMeshes) {
      this.scene.remove(im);
      im.dispose();
    }
    this.instancedMeshes = [];
    this.clearPathLines();
    this.circuitMatrices = [];
    this.templates = [];
    this.ships = [];
    this.curve = null;
  }
}
