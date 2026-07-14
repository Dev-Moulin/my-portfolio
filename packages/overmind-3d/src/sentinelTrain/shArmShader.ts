import * as THREE from 'three';

/**
 * Vertex-shader displacement for the SH* arms (no bones, ondulation procédurale).
 *
 * Implémentation **GLSL classique** via `onBeforeCompile` sur le MeshStandardMaterial
 * d'origine → 100% compatible avec le `WebGLRenderer` du portfolio (pas de TSL/WebGPU).
 *
 * Découvertes du GLB d'entraînement (voir Claude/20_Sentinel_Train/README.md) :
 *  - Le long segment de chaque bras est un NODE dont le mesh enfant porte le nom du
 *    datablock Blender (pas le préfixe SHx_) → on matche par SOUS-ARBRE, pas par nom.
 *  - Le gradient « Grad » (0 base → 1 bout) est exporté en COLOR_1 (`color_1`), le
 *    layer COLOR_0 (`color`) étant la couleur d'origine (uniforme) → on détecte
 *    automatiquement le bon attribut et on le recopie sur `color`.
 *
 * Formule (par sommet, en espace local) :
 *   grad     = gradient 0→1 base→bout
 *   offset.x = sin(uTime * uSpeed1 + uPhase1) * uForce1 * grad   // balancement lent
 *   offset.y = sin(uTime * uSpeed2 + uPhase2) * uForce2 * grad   // frémissement rapide
 */
/** Nombre d'échantillons de la chaîne leader envoyés au shader (taille fixe GLSL). */
export const LEADER_SAMPLES = 16;

/**
 * Uniforms PARTAGÉS entre les 4 bras pour le suivi du leader :
 * `deltas` = 16 déviations (espace créature) ré-échantillonnées base→bout de la
 * chaîne de bones du leader. Mutés in place chaque frame par la scène.
 */
export interface LeaderFollowUniforms {
  uLeaderDelta: { value: THREE.Vector3[] };
  uLeaderCount: { value: number };
  /** 0 = pas de suivi, 1 = copie complète du leader. */
  uFollow: { value: number };
}

export function makeLeaderFollowUniforms(): LeaderFollowUniforms {
  const deltas: THREE.Vector3[] = [];
  for (let i = 0; i < LEADER_SAMPLES; i++) deltas.push(new THREE.Vector3());
  return {
    uLeaderDelta: { value: deltas },
    uLeaderCount: { value: 0 },
    uFollow: { value: 1.0 },
  };
}

export interface SHArmUniforms {
  uTime: { value: number };
  uPhase1: { value: number };
  uPhase2: { value: number };
  uSpeed1: { value: number };
  uSpeed2: { value: number };
  uForce1: { value: number };
  uForce2: { value: number };
}

export interface SHArmWaveOptions {
  /** Phase seed dérivée de la position monde de la base. Unique par bras. */
  phaseSeed: number;
  /** Vitesse de la vague lente (rad/s). Défaut 1.0 */
  speed1?: number;
  /** Amplitude max de la vague lente (unités locales). Défaut 0.25 */
  force1?: number;
  /** Vitesse de la vague rapide. Défaut 3.0 */
  speed2?: number;
  /** Amplitude de la vague rapide. Défaut 0.06 */
  force2?: number;
}

function makeArmUniforms(opts: SHArmWaveOptions): SHArmUniforms {
  return {
    uTime: { value: 0 },
    uPhase1: { value: opts.phaseSeed },
    uPhase2: { value: opts.phaseSeed * 1.37 + 1.0 },
    uSpeed1: { value: opts.speed1 ?? 1.0 },
    uSpeed2: { value: opts.speed2 ?? 3.0 },
    uForce1: { value: opts.force1 ?? 0.25 },
    uForce2: { value: opts.force2 ?? 0.06 },
  };
}

/**
 * Clone le matériau d'origine et injecte le déplacement via `onBeforeCompile`.
 * Les `uniforms` passés sont PARTAGÉS (même objet {value}) → tous les matériaux
 * d'un même bras réagissent ensemble à uTime/boost ; les `leaderUniforms` sont
 * partagés entre TOUS les bras (la chaîne leader est unique).
 *
 * Déplacement = sinusoïde résiduelle (micro-vie, désynchronisée par bras) +
 * SUIVI DU LEADER : le gradient (0 base → 1 bout) sert de coordonnée le long du
 * bras pour interpoler la déviation du bone correspondant de la chaîne leader.
 * NB: les deltas leader sont en espace créature ; les meshes SH ont leurs
 * transforms appliqués (rotation identité) → applicables tels quels en local.
 */
function createSHArmMaterial(
  baseMaterial: THREE.Material,
  uniforms: SHArmUniforms,
  leaderUniforms: LeaderFollowUniforms,
): THREE.MeshStandardMaterial {
  const mat = (baseMaterial as THREE.MeshStandardMaterial).clone();

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    Object.assign(shader.uniforms, leaderUniforms);

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      /* glsl */ `
      uniform float uTime;
      uniform float uPhase1;
      uniform float uPhase2;
      uniform float uSpeed1;
      uniform float uSpeed2;
      uniform float uForce1;
      uniform float uForce2;
      uniform vec3 uLeaderDelta[${LEADER_SAMPLES}];
      uniform float uLeaderCount;
      uniform float uFollow;
      #ifndef USE_COLOR
        attribute vec3 color;
      #endif
      void main() {`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      {
        float shGrad = color.r;
        // Micro-vie sinusoïdale (désynchronisée par bras via uPhase*)
        transformed.x += sin(uTime * uSpeed1 + uPhase1) * uForce1 * shGrad;
        transformed.y += sin(uTime * uSpeed2 + uPhase2) * uForce2 * shGrad;
        // Suivi du leader : interpolation de la déviation à la profondeur shGrad
        if (uLeaderCount > 1.5) {
          float f = clamp(shGrad, 0.0, 1.0) * (uLeaderCount - 1.0);
          int i0 = int(floor(f));
          int i1 = min(i0 + 1, int(uLeaderCount) - 1);
          vec3 leaderD = mix(uLeaderDelta[i0], uLeaderDelta[i1], fract(f));
          transformed += leaderD * uFollow;
        }
      }`,
    );
  };

  // Tous les bras partagent le même code shader → un seul programme compilé.
  mat.customProgramCacheKey = () => 'sh-arm-wave-leader';

  return mat;
}

/** min/max du canal X d'un BufferAttribute. */
function attrRange(attr: THREE.BufferAttribute): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < attr.count; i++) {
    const v = attr.getX(i);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/**
 * S'assure que `geometry.attributes.color` contient le GRADIENT base→bout.
 * Le GLB exporte deux layers : COLOR_0 (`color`, couleur d'origine, souvent uniforme)
 * et COLOR_1 (`color_1`, le layer « Grad »). Si `color` est uniforme et `color_1`
 * varie → on recopie `color_1` sur `color`.
 * @returns description du choix (pour les logs)
 */
function ensureGradientOnColor(geom: THREE.BufferGeometry): string {
  const c = geom.attributes.color as THREE.BufferAttribute | undefined;
  const c1 = geom.attributes.color_1 as THREE.BufferAttribute | undefined;
  const EPS = 0.01;
  const cVar = c ? attrRange(c) : null;
  const c1Var = c1 ? attrRange(c1) : null;
  const cIsFlat = !cVar || (cVar.max - cVar.min) <= EPS;
  const c1Varies = c1Var !== null && (c1Var.max - c1Var.min) > EPS;
  if (cIsFlat && c1Varies && c1) {
    geom.setAttribute('color', c1);
    return `color_1 (${c1Var!.min.toFixed(2)}→${c1Var!.max.toFixed(2)})`;
  }
  if (!cIsFlat && cVar) {
    return `color (${cVar.min.toFixed(2)}→${cVar.max.toFixed(2)})`;
  }
  // Les deux uniformes (petites pièces type pinces) : on prend color_1 si dispo
  // (sa valeur uniforme correspond au gradient à cette position du bras).
  if (c1 && c1Var) {
    geom.setAttribute('color', c1);
    return `color_1 flat (${c1Var.min.toFixed(2)})`;
  }
  return cVar ? `color flat (${cVar.min.toFixed(2)})` : 'NONE';
}

export interface SHArmEntry {
  name: string;
  uniforms: SHArmUniforms;
  meshCount: number;
  /** Valeurs de base des forces (avant modulation par le boost de réactivité). */
  baseForce1: number;
  baseForce2: number;
}

/**
 * Localise les 4 bras SH par SOUS-ARBRE (tout mesh descendant d'un node `SHx_*`),
 * répare l'attribut gradient, et applique le matériau ondulant. Un set d'uniforms
 * par bras (partagé entre les matériaux du bras) → le bras ondule d'un seul tenant.
 */
export function setupSHArmShaders(
  model: THREE.Object3D,
  options: Omit<SHArmWaveOptions, 'phaseSeed'> & {
    /** Préfixes des bras à matcher. Défaut : les 4 bras du banc d'essai TRAIN.
     *  La vraie scène (Spaceship_NewV1.1) passe SH0_…SH17_. */
    armPrefixes?: string[];
  } = {},
): {
  arms: SHArmEntry[];
  totalMeshes: number;
  updateTime: (elapsedSeconds: number) => void;
  /**
   * Réactivité sinusoïdale : module l'amplitude des vagues.
   * `boost = 0` → forces de base ; `boost = 1` → forces ×2 ; etc.
   */
  setBoost: (boost: number) => void;
  /**
   * Leader-follow : uniforms partagés par tous les bras. La scène écrit chaque
   * frame les 16 deltas ré-échantillonnés de la chaîne leader (espace créature)
   * dans `uLeaderDelta.value` (mutation in place) et met `uLeaderCount.value`.
   */
  leaderUniforms: LeaderFollowUniforms;
} {
  const { armPrefixes: prefixesOpt, ...waveOpts } = options;
  const armPrefixes = prefixesOpt ?? ['SH0_', 'SH1_', 'SH2_', 'SH3_'];
  const arms: SHArmEntry[] = [];
  let totalMeshes = 0;
  const leaderUniforms = makeLeaderFollowUniforms();

  // Map mesh → préfixe de bras, en remontant les ancêtres (le segment principal
  // est un mesh enfant d'un node SHx_* mais son propre nom ne porte pas le préfixe).
  const armPrefixOf = (obj: THREE.Object3D): string | null => {
    let cur: THREE.Object3D | null = obj;
    while (cur && cur !== model) {
      for (const p of armPrefixes) {
        if (cur.name.startsWith(p)) return p;
      }
      cur = cur.parent;
    }
    return null;
  };

  // Group meshes by arm prefix
  const meshesByArm = new Map<string, THREE.Mesh[]>();
  model.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const prefix = armPrefixOf(o);
    if (!prefix) return;
    if (!meshesByArm.has(prefix)) meshesByArm.set(prefix, []);
    meshesByArm.get(prefix)!.push(o as THREE.Mesh);
  });

  const worldPos = new THREE.Vector3();

  for (const prefix of armPrefixes) {
    const meshes = meshesByArm.get(prefix);
    if (!meshes || meshes.length === 0) {
      console.warn(`[shArmShader] no meshes found in subtree of ${prefix}*`);
      continue;
    }

    // Seed = position monde du premier mesh du bras
    meshes[0].getWorldPosition(worldPos);
    const seed = worldPos.x * 12.9898 + worldPos.y * 78.233 + worldPos.z * 37.719;

    const uniforms = makeArmUniforms({ phaseSeed: seed, ...waveOpts });
    // Un matériau wave par matériau SOURCE distinct (le segment et les pinces
    // peuvent avoir des matériaux différents) — uniforms partagés par bras.
    const matCache = new Map<string, THREE.MeshStandardMaterial>();
    let meshCount = 0;
    let gradVarying = 0;

    for (const mesh of meshes) {
      const original = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!original) continue;

      const gradInfo = ensureGradientOnColor(mesh.geometry);
      if (gradInfo.includes('→')) gradVarying += 1;

      let waveMat = matCache.get(original.uuid);
      if (!waveMat) {
        waveMat = createSHArmMaterial(original, uniforms, leaderUniforms);
        matCache.set(original.uuid, waveMat);
      }
      mesh.material = waveMat;
      meshCount += 1;
    }

    console.log(`[shArmShader] ${prefix}: ${meshCount} meshes (${gradVarying} with varying gradient)`);

    arms.push({
      name: prefix.replace('_', ''),
      uniforms,
      meshCount,
      baseForce1: uniforms.uForce1.value,
      baseForce2: uniforms.uForce2.value,
    });
    totalMeshes += meshCount;
  }

  const updateTime = (elapsedSeconds: number) => {
    for (const arm of arms) arm.uniforms.uTime.value = elapsedSeconds;
  };

  const setBoost = (boost: number) => {
    for (const arm of arms) {
      arm.uniforms.uForce1.value = arm.baseForce1 * (1 + boost);
      arm.uniforms.uForce2.value = arm.baseForce2 * (1 + boost * 1.5);
    }
  };

  return { arms, totalMeshes, updateTime, setBoost, leaderUniforms };
}

// ── Variante MESH FUSIONNÉ (Spaceship_NewV2.1+) ──────────────────────────────
// V2.1 livre les petits bras en UN SEUL mesh `SmallArms_Shader_mesh` (1..n primitives)
// avec un attribut `_ARM_ID` (FLOAT 0→N-1, exposé `_arm_id` côté three) et le gradient
// Grad dans une des deux couches couleur (COLOR_0/COLOR_1, auto-détecté par
// `ensureGradientOnColor`). Plus de mesh-par-bras : la phase est PAR SOMMET via aArmId.

/** Matériau ondulant pour le mesh fusionné : phase dérivée de l'attribut `aArmId`. */
function createMergedSHArmMaterial(
  baseMaterial: THREE.Material,
  uniforms: SHArmUniforms,
  leaderUniforms: LeaderFollowUniforms,
): THREE.MeshStandardMaterial {
  const mat = (baseMaterial as THREE.MeshStandardMaterial).clone();

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    Object.assign(shader.uniforms, leaderUniforms);

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      /* glsl */ `
      uniform float uTime;
      uniform float uPhase1;
      uniform float uPhase2;
      uniform float uSpeed1;
      uniform float uSpeed2;
      uniform float uForce1;
      uniform float uForce2;
      uniform vec3 uLeaderDelta[${LEADER_SAMPLES}];
      uniform float uLeaderCount;
      uniform float uFollow;
      attribute float aArmId;
      #ifndef USE_COLOR
        attribute vec3 color;
      #endif
      void main() {`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      {
        float shGrad = color.r;
        // Déphasage unique par bras (angle d'or) → les bras ondulent désynchronisés.
        float armPhase = aArmId * 2.39996323;
        float p1 = uPhase1 + armPhase;
        float p2 = uPhase2 + armPhase * 1.37;
        transformed.x += sin(uTime * uSpeed1 + p1) * uForce1 * shGrad;
        transformed.y += sin(uTime * uSpeed2 + p2) * uForce2 * shGrad;
        // Suivi du leader : déviation (espace créature) interpolée à la profondeur shGrad.
        if (uLeaderCount > 1.5) {
          float f = clamp(shGrad, 0.0, 1.0) * (uLeaderCount - 1.0);
          int i0 = int(floor(f));
          int i1 = min(i0 + 1, int(uLeaderCount) - 1);
          vec3 leaderD = mix(uLeaderDelta[i0], uLeaderDelta[i1], fract(f));
          transformed += leaderD * uFollow;
        }
      }`,
    );
  };

  mat.customProgramCacheKey = () => 'sh-arm-merged-wave-leader';
  return mat;
}

/**
 * Applique le shader d'ondulation au(x) mesh(es) fusionné(s) des petits bras (V2.1+),
 * détecté(s) par la présence de l'attribut `_arm_id`. Un seul set d'uniforms (la phase
 * est par sommet via `aArmId`). Renvoie la même interface que `setupSHArmShaders`.
 */
export function setupSHArmShadersMerged(
  model: THREE.Object3D,
  options: Omit<SHArmWaveOptions, 'phaseSeed'> = {},
): {
  arms: SHArmEntry[];
  totalMeshes: number;
  updateTime: (elapsedSeconds: number) => void;
  setBoost: (boost: number) => void;
  leaderUniforms: LeaderFollowUniforms;
} {
  const leaderUniforms = makeLeaderFollowUniforms();
  const uniforms: SHArmUniforms = {
    uTime: { value: 0 },
    uPhase1: { value: 0 },
    uPhase2: { value: 1.0 },
    uSpeed1: { value: options.speed1 ?? 1.0 },
    uSpeed2: { value: options.speed2 ?? 3.0 },
    uForce1: { value: options.force1 ?? 0.25 },
    uForce2: { value: options.force2 ?? 0.06 },
  };

  // Détection robuste : tout mesh dont la géométrie porte `_arm_id` est un petit bras.
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.geometry as THREE.BufferGeometry)?.getAttribute?.('_arm_id')) {
      meshes.push(m);
    }
  });
  if (meshes.length === 0) {
    console.warn('[shArmShader] merged: aucun mesh avec attribut _arm_id trouvé');
  }

  let maxArmId = 0;
  let gradVarying = 0;
  const matCache = new Map<string, THREE.MeshStandardMaterial>();

  for (const mesh of meshes) {
    const geom = mesh.geometry as THREE.BufferGeometry;
    // Recopie `_arm_id` → `aArmId` (nom GLSL sûr, sans souci de préfixe underscore).
    const aid = geom.getAttribute('_arm_id') as THREE.BufferAttribute;
    geom.setAttribute('aArmId', aid);
    for (let i = 0; i < aid.count; i++) {
      const v = aid.getX(i);
      if (v > maxArmId) maxArmId = v;
    }

    const gradInfo = ensureGradientOnColor(geom);
    if (gradInfo.includes('→')) gradVarying += 1;

    const original = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
      | THREE.Material
      | undefined;
    if (!original) continue;

    let waveMat = matCache.get(original.uuid);
    if (!waveMat) {
      waveMat = createMergedSHArmMaterial(original, uniforms, leaderUniforms);
      matCache.set(original.uuid, waveMat);
    }
    mesh.material = waveMat;
  }

  console.log(
    `[shArmShader] merged: ${meshes.length} mesh(es), ${Math.round(maxArmId) + 1} bras (${gradVarying} avec gradient variable)`,
  );

  const arms: SHArmEntry[] = [
    {
      name: 'merged',
      uniforms,
      meshCount: meshes.length,
      baseForce1: uniforms.uForce1.value,
      baseForce2: uniforms.uForce2.value,
    },
  ];

  const updateTime = (elapsedSeconds: number) => {
    uniforms.uTime.value = elapsedSeconds;
  };
  const setBoost = (boost: number) => {
    uniforms.uForce1.value = arms[0].baseForce1 * (1 + boost);
    uniforms.uForce2.value = arms[0].baseForce2 * (1 + boost * 1.5);
  };

  return { arms, totalMeshes: meshes.length, updateTime, setBoost, leaderUniforms };
}
