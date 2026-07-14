import * as THREE from 'three';
import {
  setupCreatureWiggles,
  updateWiggles,
  disposeWiggles,
  setupEyeCollision,
  applyEyeCollision,
  type WiggleBoneInstance,
} from '../sentinelTrain/wiggleBones.ts';
import {
  setupSHArmShadersMerged,
  LEADER_SAMPLES,
  type LeaderFollowUniforms,
} from '../sentinelTrain/shArmShader.ts';
import type { ScrollProgress, ScrollCameraAnimator, RestPoint } from '../scene/scrollCameraAnimator.ts';
import type { WanderNavigator } from './wanderNavigation.ts';
import {
  sampleABProfile, AB_CAM_FRAME_START, AB_CAM_FRAME_END, type ABMotionProfile,
} from './abMotionProfile.ts';

/** Frames d'avance pour la visée (look-ahead) lors du rejeu du profil AB. */
const AB_LOOK_FRAMES = 8;

/** Haut du monde (pour garer la sentinelle au-dessus de la caméra au point d'entrée). */
const SENTINEL_WORLD_UP = new THREE.Vector3(0, 1, 0);
/** Réduction de taille de la sentinelle, appliquée au rig à la construction.
 *  0.765 = −10% puis −15% cumulés (0.9 × 0.85 ≈ −23.5% vs taille d'origine). */
const SENTINEL_SCALE = 0.765;
/** Lissage smoothstep (vitesse nulle aux deux bouts → raccord doux). */
function sentinelSmoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Recentre les temps d'un clip à 0 (les exports NLA Blender gardent les temps absolus de
 *  timeline). Renvoie le clip tel quel si déjà calé à 0. Partagé par `wander_B` et `sentinel_AB`. */
function normalizeClipTimes(clip: THREE.AnimationClip): THREE.AnimationClip {
  let minTime = Infinity;
  for (const track of clip.tracks) {
    if (track.times.length > 0 && track.times[0] < minTime) minTime = track.times[0];
  }
  if (minTime <= 0 || minTime === Infinity) return clip;
  const tracks = clip.tracks.map((track) => {
    const times = new Float32Array(track.times.length);
    for (let i = 0; i < track.times.length; i++) times[i] = track.times[i] - minTime;
    const Ctor = track.constructor as new (n: string, t: ArrayLike<number>, v: ArrayLike<number>) => THREE.KeyframeTrack;
    return new Ctor(track.name, times, track.values);
  });
  return new THREE.AnimationClip(clip.name, -1, tracks);
}

/** Ne garde que les pistes `position`+`quaternion` de la node `nodeName` (racine créature) et
 *  JETTE les pistes parasites — cf. GLB V2.4 : les clips embarquent `Root_Eye`/`Bone_Iris`/
 *  `Bone_Lid_*` en translation+rotation+scale (pose de repos constante) qui FIGERAIENT le blink/
 *  iris JS. Split sur le DERNIER point (le séparateur de propriété) puis COMPARE en normalisant
 *  (retrait des points/underscores) : GLTFLoader sanitize les noms de node — `Eye_Rig.001` devient
 *  `Eye_Rig001` dans les tracks — donc une comparaison littérale échouerait (⇒ 0 piste). */
function filterClipToNode(clip: THREE.AnimationClip, nodeName: string): THREE.AnimationClip {
  const norm = (s: string) => s.replace(/[._]/g, '');
  const target = norm(nodeName);
  const kept = clip.tracks.filter((t) => {
    const dot = t.name.lastIndexOf('.');
    if (dot < 0) return false;
    const node = t.name.slice(0, dot);
    const prop = t.name.slice(dot + 1);
    return norm(node) === target && (prop === 'position' || prop === 'quaternion');
  });
  return new THREE.AnimationClip(clip.name, clip.duration, kept, clip.blendMode);
}

/** Une variante bakée d'un trajet (V2.7 : `sentinel_CD` + `_v2`/`_v3`…). `startPos` = position de
 *  la frame 0 (repère parent créature) — sert à choisir, AU DÉPART du trajet, la variante la plus
 *  proche de la position courante de la nage. */
interface TrajetVariant {
  action: THREE.AnimationAction;
  name: string;
  startPos: THREE.Vector3;
}

/**
 * SentinelCreatureSystem — la créature sentinelle vivante de la vraie scène.
 *
 * Portage des techniques validées sur le banc d'essai `#sentinel-train`
 * (voir Claude/20_Sentinel_Train/README.md + Claude/21_Spaceship_NewV1/) :
 *  - suivi de la courbe AB **piloté par le scroll** (via ScrollCameraAnimator.setProgressListener)
 *  - wiggle spring-bone sur le bras leader + les 4 gros bras
 *  - leader-follow : les 18 bras SH (vertex shader) copient le mouvement réel du leader
 *  - banking dans les virages, blink, regard de l'iris, respiration des pinces
 *  - collision bras ↔ œil (clamp de la mémoire ressort)
 *  - idle « vivote sur place » quand le scroll est au repos (dwell)
 *
 * Espaces de coordonnées : la courbe AB du JSON est dans l'espace LOCAL de
 * `gltf.scene` (= espace monde du GLB, non recentré). Le modèle est ensuite
 * positionné/réduit dans la scène par SceneRenderer — toutes les conversions
 * passent donc par localToWorld/worldToLocal du modèle.
 */

// ── Armatures à bones (wiggle) — noms Blender, fuzzy-matchés au chargement ───
const WIGGLE_ARMATURES = [
  'Armature.009',      // leader (petit bras, 18 bones) — référence du leader-follow
  'ArmatureBIG1.001',
  'ArmatureBIG2.001',
  'ArmatureBIG3.001',
  'ArmatureBIG4.001',
];
const LEADER_ARMATURE = 'Armature.009';
const CREATURE_ROOT = 'Eye_Rig.001';
const EYEBALL_MESH = 'Scleral_Conjunctiva.001';

// ── Calibrages (validés visuellement sur le banc d'essai TRAIN) ──────────────
const WIGGLE_VELOCITY = 0.12;
/** Gros bras (ArmatureBIG*) : velocity plus basse = plus de lag/souplesse. 0.12 × 0.8 = 0.096
 *  → +20% de souplesse demandée, sans toucher au bras leader (qui reste à WIGGLE_VELOCITY). */
const BIG_ARM_VELOCITY = WIGGLE_VELOCITY * 0.8;
/** Lissage exponentiel du paramètre t vers la cible scroll (plus bas = plus de lag). */
const T_SMOOTH = 0.06;
const LOOK_AHEAD = 0.05;

// Banking (validé par Paul : « oui si ont peut le garder ce serait bien »)
const BANK_GAIN = 1.4;
const BANK_MAX = Math.PI / 6;
const BANK_SMOOTH = 0.06;
const BANK_LOOKAHEAD = 0.03;

// Réactivité SH (boost des vagues selon la vélocité du bout du leader)
const BOOST_GAIN = 0.6;
const BOOST_MAX = 2.5;
const BOOST_SMOOTH = 0.08;

// Blink
const BLINK_CLOSE_TIME = 0.09;
const BLINK_OPEN_TIME = 0.18;
const BLINK_UPPER_ANGLE = -0.9;
const BLINK_LOWER_ANGLE = 0.9;
const BLINK_GAP_MIN = 2.0;
const BLINK_GAP_MAX = 6.0;
const BLINK_DOUBLE_CHANCE = 0.25;

// Iris
const IRIS_SCAN_AMP = 0.10;
const IRIS_TURN_GAIN = -1.5;
const IRIS_MAX = 0.3;
const IRIS_SMOOTH = 0.07;

// Pinces (respiration seule — pas de barrel roll dans la vraie scène)
const CLAW_BREATH = 0.12;
const CLAW_BREATH_SPEED = 0.8;

// Collision œil
const EYE_COLLISION_MARGIN = 1.1;

// Idle (dwell point A) : micro-drift sur place, fréquences non-commensurables.
// Le wander en B/C/D est géré par le WanderNavigator (wanderNavigation.ts).
const IDLE_AMP = 0.25;          // unités GLB
const IDLE_WEIGHT_SMOOTH = 0.03;

/** Vitesse de t (par s) au-dessus de laquelle l'idle s'efface (la créature vole). */
const MOVING_T_SPEED = 0.005;

/** Crossfade (s) à l'entrée du clip baké `wander_B` en zone B (frame 0 = arrivée AB). */
const WANDER_B_FADE = 0.8;

/** « Accroche B » (onboarding) : sous-boucle rejouée en zone B, frames du clip `wander_B` @24fps.
 *  Segment où la créature est bien placée face caméra. Élargi 42-52 → 40-55 (accord Paul
 *  2026-07-02) : plus de place pour absorber le raccord de vitesse de la bascule différée. */
const ACCROCHE_FRAME_START = 40;
const ACCROCHE_FRAME_END = 55;
const ACCROCHE_FPS = 24;
/** Pulsation de l'aller-retour d'accroche (rad/s) : la lecture du sous-clip 40↔55 oscille en
 *  COSINUS → décélération douce aux extrémités (plus d'effet de « mur »). Plus petit = plus lent.
 *  Période d'un aller-retour complet ≈ 2π/ω. */
const ACCROCHE_OMEGA = 1.6;
/** Constante de temps (s) du relâchement d'ω après la capture : l'oscillation démarre au rythme
 *  exact de la nage (raccord de vitesse) puis se pose sur le rythme calme ACCROCHE_OMEGA. */
const ACCROCHE_OMEGA_SETTLE = 0.6;

/** Flottement 3D procédural pendant l'accroche : la créature dérive doucement dans TOUS les sens
 *  autour de son point d'arrivée (au lieu d'un aller-retour vertical). Somme de 2 sinus par axe,
 *  pulsations toutes distinctes (rapports non entiers) → la trajectoire ne se referme jamais =
 *  jamais répétitif à l'œil. Amplitudes en unités LOCALES du root Eye_Rig.001 (rendu ×0.25 monde).
 *  >>> Premier réglage à faire si le déplacement est trop grand/petit. */
const ACCROCHE_FLOAT_AMP = new THREE.Vector3(0.75, 0.0, 0.9); // X=latéral ÉCRAN, Z=profondeur écran ; Y=0 (vertical déjà assuré par l'aller-retour du clip)
/** Pulsations [ω1, ω2] (rad/s) par axe X/Y/Z — basses = très calme, distinctes = non répétitif. */
const ACCROCHE_FLOAT_FREQ: ReadonlyArray<readonly [number, number]> = [
  [0.23, 0.37], // X (gauche/droite)
  [0.31, 0.19], // Y (haut/bas)
  [0.17, 0.29], // Z (avant/arrière)
];
/** Dérive « vers la carte Holo » pendant l'accroche, le long de la DROITE ÉCRAN (vecteur droite
 *  de la caméra), en unités locales du rig. Le slider « Dérive carte » = le MAXIMUM ABSOLU
 *  atteint ; la Sentinelle NAVIGUE dans une bande proche de ce max (cf. BAND ci-dessous), jamais
 *  de retour au centre. 2.4 = l'ancien max observé (drift 1.2 + oscillation ~1.0) « +10 % »
 *  (accord Paul). L'ancienne asymétrie sur l'axe X du RIG oscillait autour du centre ET poussait
 *  dans un axe en biais par rapport à l'écran (dérive diluée). */
const ACCROCHE_DRIFT_DEFAULT = 2.4;
/** Installation de la dérive : montée LENTE dédiée (s) — « elle peut y aller tranquillement »,
 *  pas une poussée. La SORTIE, elle, reste coupée par le fondu accW (slider fondu sortie). */
const ACCROCHE_DRIFT_RISE_S = 2.5;
/** Bande de navigation, en fraction du max (slider) : elle vit entre 80 % et 100 % du max —
 *  resserrée de 70→80 % (« ça revient encore un peu trop sur la gauche », accord Paul). */
const ACCROCHE_DRIFT_BAND_LO = 0.8;
const ACCROCHE_DRIFT_BAND_HI = 1.0;
/** Valeur des sinus du flottement à t=0 (phases fixes) — SOUSTRAITE pour que la dérive démarre à
 *  offset exactement NUL à la capture (sinon ~1 unité d'offset naissait d'un coup → à-coup de
 *  vitesse mesuré : v sautait de ~2,3 à ~3,4 u/s à l'instant de la bascule). */
const ACCROCHE_FLOAT_RAW0 = new THREE.Vector3(
  0.5 * Math.sin(1.3),                 // latéral : sin(0) + 0.5·sin(1.3)
  0,                                   // (vertical inutilisé — assuré par le clip)
  Math.sin(2.1) + 0.5 * Math.sin(0.4), // profondeur
);

/** Fondu de POSITION trajet→nage (zone B). À l'entrée d'une nage (accroche ou wander_B), la
 *  position est interpolée depuis la FIN DU TRAJET vers la pose de la nage, sur AB_NAGE_TRANS_DUR
 *  secondes. AB_NAGE_TRANS_BIAS > 1 penche la courbe vers le TRAJET (la créature reste plus
 *  longtemps sur sa lancée avant de glisser dans la nage). 1 = linéaire ; plus grand = plus de
 *  temps côté trajet. Réutilisable tel quel pour les transitions BC/BD/CD/DC. */
const AB_NAGE_TRANS_DUR = 1.0;
const AB_NAGE_TRANS_BIAS = 4.0;

/** Overlap trajet AB → nage `wander_B`, réglé EN FRAMES (onglet Anim), piloté par la progression
 *  (auto) du trajet — le trajet joue seul une fois lancé, l'overlap a donc une durée fixe.
 *  - AB_XFADE_AB_FRAMES : longueur de l'overlap = ces N dernières frames du trajet AB.
 *  - AB_XFADE_WANDER_FRAMES : nb de frames du DÉBUT de la nage consommées (wander_B scrubée 0→N à
 *    l'aller, puis reprise auto). À minimiser (plancher ~8-15 : à 0 wander est figée = temps mort). */
const AB_XFADE_AB_FRAMES_DEFAULT = 60;
const AB_XFADE_WANDER_FRAMES_DEFAULT = 20;
/** Overlap de DÉPART des trajets bakés (V2.7) : les K premières frames du trajet fondent depuis la
 *  nage de la zone quittée (qui CONTINUE en auto pendant le fondu — poses différentes, le fondu
 *  glisse ; les départs sont bakés lents près du centre de zone exprès pour ça). */
const TRAJET_DEPART_FRAMES_DEFAULT = 30;
/** fps des clips Sentinelle bakés (wander_B/sentinel_AB) — convertit frames↔temps pour le scrub. */
const WANDER_FPS = 24;

/** Fondu accroche, EN FRAMES @24fps (fenêtre Transitions). Ne sert qu'à la SORTIE du tuto (poids
 *  croisés sommant à 1, la nage reprenant à la frame équivalente) et à la montée/descente des
 *  EFFETS d'accroche (flottement 3D + regard caméra). L'ENTRÉE des clips, elle, est une BASCULE
 *  DIFFÉRÉE SANS fondu : on attend que la nage franchisse le milieu de la fenêtre 40-55 et on
 *  capture la boucle à pose ET vitesse identiques (même clip). */
const ACC_XFADE_FRAMES_DEFAULT = 15;

export class SentinelCreatureSystem {
  private model: THREE.Object3D;
  private curve: THREE.CurvePath<THREE.Vector3>;
  private creature: THREE.Object3D | null = null;

  // Scroll state
  private tTarget = 0;
  private tCurrent = 0;
  private elapsed = 0;

  // Wiggle + collision
  private wiggles: WiggleBoneInstance[] = [];
  private collisionWiggles: WiggleBoneInstance[] = [];
  private eyeCollisionRadius = 0;

  // Leader-follow
  private leaderChain: THREE.Object3D[] = [];
  private leaderRestPos: THREE.Vector3[] = [];
  private leaderTParams: number[] = [];
  private leaderDeltas: THREE.Vector3[] = [];
  private leaderUniforms: LeaderFollowUniforms | null = null;
  private leaderTip: THREE.Object3D | null = null;

  // SH shader
  private shUpdateTime: ((elapsed: number) => void) | null = null;
  private shSetBoost: ((boost: number) => void) | null = null;

  // Eye bones
  private lidUpper: THREE.Object3D | null = null;
  private lidLower: THREE.Object3D | null = null;
  private lidUpperRestX = 0;
  private lidLowerRestX = 0;
  private irisBone: THREE.Object3D | null = null;
  private irisRestX = 0;
  private irisRestZ = 0;

  // Claws
  private clawBones: Array<{ bone: THREE.Object3D; armPhase: number }> = [];

  // Navigation
  private camera: THREE.Camera | null = null;
  private animator: ScrollCameraAnimator | null = null; // orientation de repos (Fix A1, hors free-look)
  private nav: WanderNavigator | null = null;       // wander/traverse B/C/D
  // Clip baké `wander_B` (Blender) : nage chorégraphiée pendant le repos en zone B.
  private wanderMixer: THREE.AnimationMixer | null = null;
  private wanderBAction: THREE.AnimationAction | null = null;
  private accrocheAction: THREE.AnimationAction | null = null; // sous-boucle d'accroche B (onboarding)
  private accrocheB = false;                                    // piloté par onboardingMachine (provisoire : via AB)
  private accrocheWasActive = false;                            // détecte la transition d'entrée (reset horloges)
  private accrocheFloatT = 0;                                   // horloge du flottement 3D (s)
  private accrochePhase = 0;                                    // phase de l'oscillation cosinus (aller-retour 40↔55)
  private accrocheLatched = false;                              // boucle capturée (bascule différée effectuée)
  private accrocheOmega = ACCROCHE_OMEGA;                       // ω courant (raccord de vitesse → rythme calme)
  private accrocheDrift = ACCROCHE_DRIFT_DEFAULT;               // biais « vers la carte » (droite écran, unités locales)
  private accMatInv = new THREE.Matrix4();                      // inverse monde→local du parent (dérive écran)
  private accRightTmp = new THREE.Vector3();                    // droite caméra convertie en local parent
  private accFwdTmp = new THREE.Vector3();                      // avant caméra converti en local parent
  private accrocheDuration = 0;                                 // durée RÉELLE du sous-clip d'accroche (s)
  private accrocheStartTime = ACCROCHE_FRAME_START / ACCROCHE_FPS; // début RÉEL du sous-clip dans wander_B (s)
  private accW = 0;                                             // poids du fondu croisé accroche (0=nage, 1=accroche)
  private accXfadeFrames = ACC_XFADE_FRAMES_DEFAULT;            // longueur du fondu accroche↔nage (frames @24fps)
  private dwellBWasActive = false;                             // détecte l'entrée en zone de nage (capture pos fin trajet)
  private transFromPos = new THREE.Vector3();                  // position de fin de trajet (départ du fondu de position)
  private transElapsed = AB_NAGE_TRANS_DUR;                    // chrono du fondu (init = fini → pas de fondu au boot)
  private transTmp = new THREE.Vector3();                      // scratch fondu de position
  private accrocheFloatOffset = new THREE.Vector3();            // offset 3D courant (réutilisé, zéro alloc)
  private onArriveB: ((active: boolean) => void) | null = null; // déclencheur onboarding (arrivée B via AB)
  private lastArriveB = false;                                  // dernier état du déclencheur (détecte le changement)
  private lastSegment: string | null = null;                   // dernier trajet joué (détecte l'arrivée via AB)
  private abMode = true;                              // true tant qu'on est sur AB / point A
  private abProfile: ABMotionProfile | null = null;  // mouvement baké de la sentinelle sur AB
  private abFrame = 1;                                // frame Blender courante du profil AB
  private abActive = false;                           // true uniquement pendant le segment AB
  private abT = 0;                                    // t du scroll AB (0..1)

  // Clip baké `sentinel_AB` (GLB V2.4) : trajet AB scrubé via le MÊME wanderMixer, crossfadé ↔ wander_B.
  private sentinelABAction: THREE.AnimationAction | null = null;
  private sentinelABDuration = 0;
  private sentinelABFrameStart = 1;                   // 1re frame Blender du clip (timeline 1→500)
  private sentinelABFrameEnd = AB_CAM_FRAME_END;      // dernière frame (500), recalée data-driven à l'import
  private abClipWasActive = false;                    // arête AB(clip) ↔ autre → déclenche les crossfades
  private xfadeAbFrames = AB_XFADE_AB_FRAMES_DEFAULT;      // longueur overlap = N dernières frames du trajet AB
  private xfadeWanderFrames = AB_XFADE_WANDER_FRAMES_DEFAULT; // frames du début de wander_B consommées (scrub aller)
  private abReturnFromB = false;                            // entrée AB depuis la nage (retour) → wander en auto, pas scrub

  // ── Trajets bakés GÉNÉRIQUES (V2.7, pilote BC) : clips scrubés à la progression caméra + nages
  // de zone bakées. B garde ses champs historiques (wanderBAction/sentinelABAction) ; le reste
  // passe par ces Maps — les 5 autres trajets et les variantes s'ajouteront par simple wiring.
  private zoneWanderActions = new Map<string, THREE.AnimationAction>(); // 'C'/'D' → boucle de nage
  // 'BC'… → variantes du trajet ([0] = original, puis _v2/_v3). La nage d'une zone pouvant être
  // n'importe où dans sa boucle au moment du scroll, on choisit AU DÉPART la variante dont la
  // frame 0 est la plus proche de la position courante (raccords pose+vitesse garantis à la source).
  private trajetActions = new Map<string, TrajetVariant[]>();
  private trajetActive: TrajetVariant | null = null;                    // variante en cours de lecture
  private trajetWasActive: string | null = null;                        // arête d'entrée du régime trajet
  private trajetForcedVariant: number | null = null;                    // DEV : force la variante N (0-based), null = auto
  private xfadeDepartFrames = TRAJET_DEPART_FRAMES_DEFAULT;             // overlap de DÉPART (frames du trajet)
  private lastProg: ScrollProgress | null = null;                       // dernier progress (segment/t/from/to)
  private animDebugEnabled = false;                    // émet overmind:sentinel-anim (HUD onglet Anim)
  private animDebugAccum = 0;                           // throttle de l'émission debug
  // Trace console (demande Paul) : RESSERRÉE sur la zone de capture nage→accroche.
  private traceOn = false;                              // trace en cours
  private traceTick = 0;                                // compteur frames render (1 log / 2)
  private tracePostS = 0;                               // secondes restantes avant fin de trace
  private tracePrevPos = new THREE.Vector3();           // position au log précédent (vitesse mesurée)
  private tracePrevT = 0;                               // elapsed au log précédent
  private currentRegime = 'idle';                      // régime d'anim courant (affiché dans le HUD)

  // Entrée scénarisée : au repos A la sentinelle est garée hors-champ (derrière + au-dessus
  // de la caméra) ; au démarrage AB elle plonge et rejoint le tracé (rattrape son retard).
  private entryBack = 10;        // recul derrière la caméra (monde)
  private entryUp = 15;          // hauteur au-dessus de la caméra (monde)
  private entryCatchUp = 0.14;   // fraction du trajet AB pour rejoindre le tracé
  private entryPointWorld = new THREE.Vector3(); // point de lancement (monde), figé au départ
  private entryCaptured = false;

  // Animation state
  private smoothedBank = 0;
  private lastTurn = 0;
  private smoothedIrisYaw = 0;
  private blinkPhase = -1;
  private nextBlinkAt = 2.0;
  private pendingDoubleBlink = false;
  private smoothedBoost = 0;
  private tipInitialized = false;
  private idleWeight = 0;
  private idleSeed: number;

  // Pre-allocated temps (zero alloc per frame)
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tanA = new THREE.Vector3();
  private tanB = new THREE.Vector3();
  private tipLocal = new THREE.Vector3();
  private prevTipLocal = new THREE.Vector3();
  private eyeCenterTmp = new THREE.Vector3();
  private collTmp = new THREE.Vector3();
  private camTmp = new THREE.Vector3();
  private navCurPos = new THREE.Vector3();
  private qPathTmp = new THREE.Quaternion();
  private entryLocalTmp = new THREE.Vector3();
  private entryDirTmp = new THREE.Vector3();

  constructor(
    model: THREE.Object3D,
    curveAB: THREE.CurvePath<THREE.Vector3>,
    camera?: THREE.Camera,
  ) {
    this.model = model;
    this.curve = curveAB;
    this.camera = camera ?? null;
    this.idleSeed = Math.random() * 10;

    // GLTFLoader strips dots from node names ("Eye_Rig.001" → "Eye_Rig001")
    const find = (name: string): THREE.Object3D | null => this.findNode(name);

    this.creature = find(CREATURE_ROOT);
    if (!this.creature) {
      console.warn(`[SentinelCreature] root "${CREATURE_ROOT}" not found — system disabled`);
      return;
    }
    console.log(`[SentinelCreature] root found: ${this.creature.name}`);

    // Réduction de taille (−10%) AVANT toutes les captures (collision/wiggle) → cohérence.
    this.creature.scale.multiplyScalar(SENTINEL_SCALE);
    this.creature.updateMatrixWorld(true);

    // ── Leader chain — captured BEFORE wiggle setup (WiggleBone inserts proxy
    // clones into the hierarchy; capturing now gives the clean chain of real bones).
    const leaderArm = find(LEADER_ARMATURE);
    if (leaderArm) {
      let tip: THREE.Object3D | null = null;
      let maxDepth = -1;
      leaderArm.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        let depth = 0;
        let p: THREE.Object3D | null = o.parent;
        while (p && p !== leaderArm) { depth += 1; p = p.parent; }
        if (depth > maxDepth) { maxDepth = depth; tip = o; }
      });
      const tipObj = tip as THREE.Object3D | null;
      if (tipObj) {
        this.leaderTip = tipObj;
        const chain: THREE.Object3D[] = [];
        let cur: THREE.Object3D | null = tipObj;
        while (cur && cur !== leaderArm) {
          if ((cur as THREE.Bone).isBone) chain.unshift(cur);
          cur = cur.parent;
        }
        this.leaderChain = chain;
        const v = new THREE.Vector3();
        let total = 0;
        for (let i = 0; i < chain.length; i++) {
          chain[i].getWorldPosition(v);
          this.creature.worldToLocal(v);
          this.leaderRestPos.push(v.clone());
          if (i === 0) this.leaderTParams.push(0);
          else {
            total += this.leaderRestPos[i].distanceTo(this.leaderRestPos[i - 1]);
            this.leaderTParams.push(total);
          }
        }
        if (total > 0) for (let i = 0; i < this.leaderTParams.length; i++) this.leaderTParams[i] /= total;
        this.leaderDeltas = this.leaderRestPos.map(() => new THREE.Vector3());
        console.log(`[SentinelCreature] leader chain: ${chain.length} bones (tip=${tipObj.name})`);
      }
    } else {
      console.warn('[SentinelCreature] leader armature not found — leader-follow disabled');
    }

    // ── Eye bones (Eye_Rig is not wiggled → direct drive)
    this.lidUpper = find('Bone_Lid_Upper');
    this.lidLower = find('Bone_Lid_Lower');
    this.irisBone = find('Bone_Iris');
    if (this.lidUpper) this.lidUpperRestX = this.lidUpper.rotation.x;
    if (this.lidLower) this.lidLowerRestX = this.lidLower.rotation.x;
    if (this.irisBone) { this.irisRestX = this.irisBone.rotation.x; this.irisRestZ = this.irisBone.rotation.z; }
    console.log(`[SentinelCreature] eye bones: lidUpper=${!!this.lidUpper} lidLower=${!!this.lidLower} iris=${!!this.irisBone}`);

    // ── Claw bones (palm = bone with ≥2 bone children; descendants = fingers).
    // Captured BEFORE wiggle setup.
    let armIdx = 0;
    for (const armName of WIGGLE_ARMATURES) {
      const arm = find(armName);
      if (!arm) continue;
      const armPhase = armIdx * 1.7;
      arm.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        const boneChildren = o.children.filter((c) => (c as THREE.Bone).isBone);
        if (boneChildren.length < 2) return;
        o.traverse((d) => {
          if (d === o) return;
          if ((d as THREE.Bone).isBone) this.clawBones.push({ bone: d, armPhase });
        });
      });
      armIdx += 1;
    }
    console.log(`[SentinelCreature] claw bones captured: ${this.clawBones.length}`);

    // ── Wiggle spring-bones (2 réglages : leader à WIGGLE_VELOCITY, gros bras plus souples)
    const bigArmNames = WIGGLE_ARMATURES.filter((n) => n.startsWith('ArmatureBIG'));
    const leaderArmNames = WIGGLE_ARMATURES.filter((n) => !n.startsWith('ArmatureBIG'));
    const leaderWiggle = setupCreatureWiggles(model, leaderArmNames, WIGGLE_VELOCITY);
    const bigWiggle = setupCreatureWiggles(model, bigArmNames, BIG_ARM_VELOCITY);
    this.wiggles = [...leaderWiggle.wiggles, ...bigWiggle.wiggles];
    const missing = [...leaderWiggle.missingArmatures, ...bigWiggle.missingArmatures];
    if (missing.length > 0) {
      console.warn('[SentinelCreature] wiggle armatures MISSING:', missing);
    }
    for (const pa of [...leaderWiggle.perArmature, ...bigWiggle.perArmature]) {
      console.log(`[SentinelCreature]   ${pa.name}: ${pa.wiggleBones} wiggle / ${pa.totalBones} bones`);
    }
    console.log(`[SentinelCreature] wiggle bones total: ${this.wiggles.length} (leader velocity=${WIGGLE_VELOCITY}, gros bras=${BIG_ARM_VELOCITY.toFixed(3)})`);

    // ── Eye collision sphere (radius from the eyeball mesh, world units)
    const eyeball = find(EYEBALL_MESH);
    if (eyeball) {
      const box = new THREE.Box3().setFromObject(eyeball);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      this.eyeCollisionRadius = sphere.radius * EYE_COLLISION_MARGIN;
      const eyeCenter = new THREE.Vector3();
      this.creature.getWorldPosition(eyeCenter);
      this.collisionWiggles = setupEyeCollision(this.wiggles, eyeCenter, this.eyeCollisionRadius);
      console.log(`[SentinelCreature] eye collision: radius=${this.eyeCollisionRadius.toFixed(2)}, constrained ${this.collisionWiggles.length}/${this.wiggles.length} bones`);
    } else {
      console.warn(`[SentinelCreature] ${EYEBALL_MESH} not found — eye collision disabled`);
    }

    // ── Vertex shader sur le mesh fusionné des petits bras (V2.1 : SmallArms_Shader_mesh
    //    avec attribut _arm_id + gradient COLOR_0/1) — sinusoïde résiduelle + leader-follow.
    const shResult = setupSHArmShadersMerged(model, {
      speed1: 1.2, force1: 0.08, speed2: 3.5, force2: 0.03,
    });
    this.shUpdateTime = shResult.updateTime;
    this.shSetBoost = shResult.setBoost;
    this.leaderUniforms = shResult.leaderUniforms;
    console.log(`[SentinelCreature] SH arms (merged) shaded: ${shResult.totalMeshes} mesh(es)`);

    // Position initiale : début de la courbe AB (point A)
    this.tTarget = 0;
    this.tCurrent = 0;
  }

  /** Injecte le navigateur wander (B/C/D). */
  setWanderNavigator(nav: WanderNavigator): void {
    this.nav = nav;
  }

  /** Résout un nœud du GLB (GLTFLoader retire les points : "Eye_Rig.001" → "Eye_Rig001"). */
  private findNode(name: string): THREE.Object3D | null {
    const m = this.model;
    return m.getObjectByName(name)
      ?? m.getObjectByName(name.replace(/\./g, ''))
      ?? m.getObjectByName(name.replace(/\./g, '_'))
      ?? null;
  }

  /**
   * Injecte le clip baké `wander_B` (depuis `gltf.animations`) et crée le mixer créature.
   * Le clip n'anime que pos+rot LOCALES d'`Eye_Rig.001` (pas de piste scale → SENTINEL_SCALE
   * préservé). Joué en boucle pendant le repos en zone B ; le procédural est court-circuité
   * ces frames-là (cf. update()). Frame 0 = pose d'arrivée AB → raccord vol→nage continu.
   */
  setWanderClip(clip: THREE.AnimationClip): void {
    if (!this.creature) return;
    // Normalise les temps à 0 (exports NLA Blender = temps absolus) PUIS filtre sur Eye_Rig.001
    // (jette les 12 pistes de bones parasites du GLB V2.4 qui figeraient le blink/iris JS).
    const normalized = filterClipToNode(normalizeClipTimes(clip), CREATURE_ROOT);
    // Mixer sur le modèle (comme les clips caméra) → résolution des pistes par nom de nœud.
    this.wanderMixer = new THREE.AnimationMixer(this.model);
    this.wanderBAction = this.wanderMixer.clipAction(normalized);
    this.wanderBAction.setLoop(THREE.LoopRepeat, Infinity);
    // Sous-boucle d'accroche (onboarding B) : court segment rejoué en boucle (position) ; la
    // rotation sera forcée vers la caméra dans update() quand `accrocheB` est actif.
    const accrocheClip = THREE.AnimationUtils.subclip(
      normalized, 'accroche_B', ACCROCHE_FRAME_START, ACCROCHE_FRAME_END, ACCROCHE_FPS,
    );
    this.accrocheAction = this.wanderMixer.clipAction(accrocheClip);
    this.accrocheDuration = accrocheClip.duration; // lecture pilotée à la main (oscillation cosinus dans update)
    // Début RÉEL du sous-clip dans wander_B : subclip() garde les keys de frame ∈ [start, end) puis
    // les recale à 0 — la 1re key gardée ne tombe pas forcément pile sur la frame 40 (bornes réelles
    // mesurées ≈ 13 f, pas 15). Toute conversion via les constantes théoriques décalait la pose
    // d'~1 frame à la capture (le « chouille abrupt ») → on MESURE le vrai point de départ.
    let accStart = Infinity;
    for (const tr of normalized.tracks) {
      for (let i = 0; i < tr.times.length; i++) {
        if (tr.times[i] * ACCROCHE_FPS >= ACCROCHE_FRAME_START) {
          if (tr.times[i] < accStart) accStart = tr.times[i];
          break;
        }
      }
    }
    if (accStart !== Infinity) this.accrocheStartTime = accStart;
    console.log(`[SentinelCreature] wander_B prêt: ${normalized.duration.toFixed(1)}s, ${normalized.tracks.length} pistes`
      + ` (accroche réelle f${(this.accrocheStartTime * ACCROCHE_FPS).toFixed(2)}→f${((this.accrocheStartTime + this.accrocheDuration) * ACCROCHE_FPS).toFixed(2)})`);
  }

  /**
   * Injecte le clip baké `sentinel_AB` (GLB V2.4) = le trajet AB de la créature, dans le MÊME
   * repère qu'`wander_B` (raccord garanti : dernière frame == wander_B frame 0). Il est scrubé à la
   * main via le wanderMixer (comme l'accroche) puis crossfadé nativement ↔ wander_B dans update().
   * Requiert que le mixer existe → **appeler APRÈS `setWanderClip`**.
   */
  setSentinelABClip(clip: THREE.AnimationClip): void {
    if (!this.creature || !this.wanderMixer) {
      console.warn('[SentinelCreature] setSentinelABClip: mixer absent (appeler après setWanderClip) — ignoré');
      return;
    }
    const normalized = filterClipToNode(normalizeClipTimes(clip), CREATURE_ROOT);
    this.sentinelABAction = this.wanderMixer.clipAction(normalized);
    this.sentinelABAction.setLoop(THREE.LoopOnce, 1);
    this.sentinelABAction.clampWhenFinished = true;
    this.sentinelABAction.enabled = false;
    this.sentinelABDuration = normalized.duration;
    // Nb de frames Blender = nb de keyframes de la piste position (data-driven, sans fps codé en dur).
    const eyeTrack = normalized.tracks.find((t) => t.name.endsWith('.position')) ?? normalized.tracks[0];
    const keys = eyeTrack ? eyeTrack.times.length : (this.sentinelABFrameEnd - this.sentinelABFrameStart + 1);
    this.sentinelABFrameEnd = this.sentinelABFrameStart + keys - 1;
    console.log(`[SentinelCreature] sentinel_AB prêt: ${this.sentinelABDuration.toFixed(2)}s, ${normalized.tracks.length} pistes, frames ${this.sentinelABFrameStart}→${this.sentinelABFrameEnd}`);
  }

  /** Injecte une boucle de nage bakée pour une zone (C/D) — pendant de `wander_B` pour les autres
   *  zones (V2.6+). Requiert le mixer → appeler APRÈS `setWanderClip`. */
  setZoneWanderClip(zone: 'C' | 'D', clip: THREE.AnimationClip): void {
    if (!this.creature || !this.wanderMixer) {
      console.warn(`[SentinelCreature] setZoneWanderClip(${zone}): mixer absent (appeler après setWanderClip) — ignoré`);
      return;
    }
    const normalized = filterClipToNode(normalizeClipTimes(clip), CREATURE_ROOT);
    const action = this.wanderMixer.clipAction(normalized);
    action.setLoop(THREE.LoopRepeat, Infinity);
    this.zoneWanderActions.set(zone, action);
    console.log(`[SentinelCreature] wander_${zone} prêt: ${normalized.duration.toFixed(1)}s, ${normalized.tracks.length} pistes`);
  }

  /** Injecte un clip de trajet baké (`sentinel_BC`…, V2.7). Timeline == clip caméra du segment →
   *  scrubé à la progression caméra (time = t·durée, pas de décalage type 53→500). Overlaps de
   *  départ/arrivée gérés dans update(). Appelable PLUSIEURS fois par segment : chaque appel
   *  ajoute une VARIANTE (appeler l'original d'abord, puis `_v2`/`_v3` — mêmes fenêtres caméra).
   *  Requiert le mixer → appeler APRÈS `setWanderClip`. */
  setTrajetClip(segment: string, clip: THREE.AnimationClip): void {
    if (!this.creature || !this.wanderMixer) {
      console.warn(`[SentinelCreature] setTrajetClip(${segment}): mixer absent (appeler après setWanderClip) — ignoré`);
      return;
    }
    const normalized = filterClipToNode(normalizeClipTimes(clip), CREATURE_ROOT);
    const action = this.wanderMixer.clipAction(normalized);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = false;
    const posTrack = normalized.tracks.find((t) => t.name.endsWith('.position'));
    const startPos = new THREE.Vector3();
    if (posTrack && posTrack.values.length >= 3) startPos.fromArray(posTrack.values, 0);
    const list = this.trajetActions.get(segment) ?? [];
    list.push({ action, name: clip.name, startPos });
    this.trajetActions.set(segment, list);
    console.log(`[SentinelCreature] ${clip.name} prêt (trajet ${segment}${list.length > 1 ? `, variante ${list.length}` : ''}): ${normalized.duration.toFixed(2)}s (${Math.round(normalized.duration * WANDER_FPS)} frames)`);
  }

  /** Nage bakée d'une zone : B = champ historique, C/D = Map (null si pas encore livrée/câblée). */
  private getZoneWander(zone: string): THREE.AnimationAction | null {
    if (zone === 'B') return this.wanderBAction;
    return this.zoneWanderActions.get(zone) ?? null;
  }

  /** DEV (fenêtre Transitions) : force la variante d'index N (0 = original, 1 = _v2, 2 = _v3)
   *  au prochain départ de trajet — pour tester chaque « bretelle » à l'œil sans dépendre d'où
   *  la nage se trouve. null = retour au choix automatique par proximité. */
  setTrajetForcedVariant(idx: number | null): void {
    this.trajetForcedVariant = idx === null ? null : Math.max(0, Math.round(idx));
  }

  /** Variante du trajet dont la frame 0 est la plus proche de la position courante de la créature
   *  (la nage peut être n'importe où dans sa boucle au moment où le scroll lance le trajet). */
  private pickTrajetVariant(segment: string): TrajetVariant {
    const list = this.trajetActions.get(segment)!;
    // DEV : variante forcée — si le segment n'a pas cet index (ex : DB n'a qu'un clip), choix auto.
    if (this.trajetForcedVariant !== null && this.trajetForcedVariant < list.length) {
      return list[this.trajetForcedVariant];
    }
    if (list.length === 1 || !this.creature) return list[0];
    let best = list[0];
    let bestD = Infinity;
    for (const v of list) {
      const d = v.startPos.distanceToSquared(this.creature.position);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  /** Retire du mixer toutes les variantes de tous les trajets bakés (purge de changement de régime). */
  private stopAllTrajets(): void {
    for (const list of this.trajetActions.values()) {
      for (const v of list) if (v.action.isScheduled()) v.action.stop();
    }
  }

  /** Overlap de DÉPART des trajets bakés, en frames du trajet (fenêtre Transitions). */
  setXfadeDepartFrames(frames: number): void {
    this.xfadeDepartFrames = Math.max(0, Math.min(120, Math.round(frames)));
  }

  /** Convertit une frame Blender AB (53→500) en temps du clip normalisé `sentinel_AB`. Fps-free :
   *  abFrame=500 → duration (= raccord wander_B f0) ; abFrame=53 → ≈2.167s (= frame 53 @24fps). */
  private abFrameToClipTime(abFrame: number): number {
    const span = this.sentinelABFrameEnd - this.sentinelABFrameStart;
    if (span <= 0) return 0;
    const u = Math.max(0, Math.min(1, (abFrame - this.sentinelABFrameStart) / span));
    return u * this.sentinelABDuration;
  }

  /** Active/désactive l'« accroche B » (onboarding) : sous-boucle + regard caméra forcé.
   *  Piloté par l'onboardingMachine (provisoirement déclenché à l'arrivée via AB). */
  setAccrocheB(active: boolean): void {
    this.accrocheB = active;
  }

  /** Longueur de l'overlap AB→wander_B = N dernières frames du trajet AB (onglet Anim). */
  setXfadeAbFrames(frames: number): void {
    this.xfadeAbFrames = Math.max(1, Math.min(300, Math.round(frames)));
  }

  /** Frames du début de `wander_B` consommées par l'overlap (scrub aller). À minimiser (onglet Anim). */
  setXfadeWanderFrames(frames: number): void {
    this.xfadeWanderFrames = Math.max(0, Math.min(120, Math.round(frames)));
  }

  /** Fondu accroche en frames @24fps (fenêtre Transitions) : SORTIE du tuto + montée/descente des
   *  effets (float 3D, regard caméra). L'entrée des clips est une bascule différée sans fondu. */
  setAccXfadeFrames(frames: number): void {
    this.accXfadeFrames = Math.max(1, Math.min(120, Math.round(frames)));
  }

  /** Dérive « vers la carte » pendant l'accroche = biais constant le long de la droite ÉCRAN,
   *  en unités locales du rig (fenêtre Transitions, slider « Dérive carte »). */
  setAccrocheDrift(units: number): void {
    this.accrocheDrift = Math.max(0, Math.min(4, units));
  }

  /** Active l'émission du flux de debug d'animation (`overmind:sentinel-anim`) pour le HUD. */
  setAnimDebug(enabled: boolean): void {
    if (enabled && !this.animDebugEnabled) console.log('[SentinelAnim] flux debug ACTIVÉ');
    this.animDebugEnabled = enabled;
  }

  /** Callback du déclencheur d'onboarding : appelé quand la créature ARRIVE (true) / QUITTE (false)
   *  le repos en B via le trajet AB. C'est l'onboardingBridge qui décide ensuite de jouer l'accroche. */
  setOnArriveB(cb: (active: boolean) => void): void {
    this.onArriveB = cb;
  }

  /** Position MONDE de l'œil (root créature) — pour ancrer la bulle d'onboarding (projection 2D). */
  getEyeWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    (this.creature ?? this.model).getWorldPosition(target);
    return target;
  }

  /** Injecte le profil de mouvement baké de la sentinelle sur AB. */
  setABProfile(profile: ABMotionProfile): void {
    this.abProfile = profile;
  }

  /** Profil AB chargé (positions par frame, mutables en live par l'éditeur de zone). */
  getABProfile(): ABMotionProfile | null {
    return this.abProfile;
  }

  /** Capture le point de lancement (monde) : derrière + au-dessus de la caméra courante. */
  private captureEntryPoint(): void {
    if (!this.camera) return;
    this.camera.getWorldPosition(this.camTmp);
    // Fix A1 : direction de REPOS (sans free-look) si l'animator est branché → le point de lancement
    // ne suit plus le regard de l'utilisateur. Fallback : direction caméra courante.
    if (this.animator) this.animator.getRestForward(this.entryDirTmp);
    else this.camera.getWorldDirection(this.entryDirTmp); // avant caméra (unitaire)
    this.entryPointWorld.copy(this.camTmp)
      .addScaledVector(this.entryDirTmp, -this.entryBack) // derrière = -avant
      .add(SENTINEL_WORLD_UP.clone().multiplyScalar(this.entryUp)); // au-dessus (monde)
    this.entryCaptured = true;
  }

  /** Câble l'animator caméra (pour l'orientation de repos — Fix A1). */
  setCameraAnimator(a: ScrollCameraAnimator): void {
    this.animator = a;
  }

  /** Re-synchronise l'état d'animation après une TÉLÉPORTATION NavArc : stoppe toute action
   *  résiduelle et remet les drapeaux d'arête à zéro, pour que la frame suivante relance proprement
   *  la nage/le trajet du nouveau point (wander_B repart de f0 → capture d'accroche rapide, plus de
   *  phase résiduelle). Le point de départ AB, lui, est corrigé par le Fix A1 (captureEntryPoint). */
  resyncOnJump(point: RestPoint): void {
    if (this.wanderBAction?.isScheduled()) this.wanderBAction.stop();
    if (this.accrocheAction?.isScheduled()) this.accrocheAction.stop();
    if (this.sentinelABAction?.isScheduled()) this.sentinelABAction.stop();
    this.stopAllTrajets();
    for (const a of this.zoneWanderActions.values()) if (a.isScheduled()) a.stop();
    // Drapeaux d'arête → repartir comme une entrée fraîche.
    this.dwellBWasActive = false;
    this.abClipWasActive = false;
    this.trajetWasActive = null;
    this.trajetActive = null;
    this.abReturnFromB = false;
    this.accrocheLatched = false;
    this.accrocheWasActive = false;
    this.accW = 0;
    this.accrocheFloatT = 0;
    this.accrochePhase = 0;
    if (this.animDebugEnabled) console.log(`[SentinelTrace] ↺ resync sur téléportation → ${point}`);
  }

  /** Réglage live de l'entrée scénarisée (DevPanel). */
  setEntryConfig(c: { back?: number; up?: number; catchUp?: number }): void {
    if (c.back !== undefined) this.entryBack = c.back;
    if (c.up !== undefined) this.entryUp = c.up;
    if (c.catchUp !== undefined) this.entryCatchUp = c.catchUp;
  }
  getEntryConfig(): { back: number; up: number; catchUp: number } {
    return { back: this.entryBack, up: this.entryUp, catchUp: this.entryCatchUp };
  }

  /** Branché sur ScrollCameraAnimator.setProgressListener — appelé chaque frame. */
  setScrollProgress(p: ScrollProgress): void {
    // AB = trajet de présentation (une fois). Tant qu'on est sur AB ou au point A,
    // la créature rejoue son profil baké. Sinon, tout passe par le navigateur wander.
    this.lastProg = p; // consommé par les régimes trajet baké / dwell de zone (update)
    if (p.segment) this.lastSegment = p.segment; // mémorise le dernier trajet (détecte « via AB »)
    this.abMode = p.restPoint === 'A' || p.segment === 'AB';
    if (this.abMode) {
      if (p.segment === 'AB') {
        const t = Math.max(0, Math.min(1, p.t));
        // Calé sur la frame caméra (gère le décalage de 52 frames : caméra 53→500)
        this.abFrame = AB_CAM_FRAME_START + t * (AB_CAM_FRAME_END - AB_CAM_FRAME_START);
        this.tTarget = t;
        this.abActive = true;
        this.abT = t;
      } else {
        // Dwell au point A → garée au point d'entrée (hors-champ), prête à plonger.
        this.abFrame = 1;
        this.tTarget = p.restPoint === 'A' ? 0 : 1;
        this.abActive = false;
        // Re-capture le point d'entrée tant qu'on est posé en A (suit la pose caméra A).
        if (p.restPoint === 'A') this.captureEntryPoint();
      }
    } else {
      this.abActive = false;
      // Déclencheur onboarding : arrivée AU REPOS en B via le trajet AB. On NOTIFIE le bridge ;
      // c'est l'onboardingMachine qui décide de jouer l'accroche (setAccrocheB).
      const arriveB = p.restPoint === 'B' && p.segment === null && this.lastSegment === 'AB';
      if (arriveB !== this.lastArriveB) {
        this.lastArriveB = arriveB;
        this.onArriveB?.(arriveB);
      }
      this.nav?.setScrollProgress(p);
    }
  }

  /** À appeler chaque frame depuis la boucle d'animation. */
  update(dt: number): void {
    if (!this.creature) return;
    this.elapsed += dt;
    const creature = this.creature;
    const model = this.model;

    // ── Position + visée selon le mode (AB une fois, sinon wander/traverse B/C/D)
    let wanderWeight = 0;
    let bankTarget = 0;
    let rollExact: number | null = null; // roll baké AB appliqué tel quel (vrilles)

    // Repos en zone B : le clip baké `wander_B` (Blender) pilote la nage. Le mixer possède
    // pos+rot LOCALES d'Eye_Rig.001 → on saute l'application de la pose procédurale ces
    // frames-là (cf. plus bas). C/D restent procéduraux (pas encore de clips bakés).
    const dwellB = !this.abMode && this.wanderBAction !== null && this.nav?.isDwellB() === true;
    let accroche = false; // boucle accroche ACTIVE (= capturée) — décidé dans le bloc dwellB
    // Régime clip AB (V2.4) : sur AB, le trajet est piloté par le clip baké `sentinel_AB` via le
    // MÊME wanderMixer (scrub) → on saute le rejeu du profil JSON et la pose procédurale.
    const abClipMode = this.abMode && this.sentinelABAction !== null;
    // Régimes GÉNÉRIQUES (V2.7) : trajet baké actif (segment câblé dans trajetActions)
    // et repos dans une zone à nage bakée (C/D — B garde son régime dwellB dédié à l'accroche).
    // Les segments/zones NON câblés tombent naturellement dans le fallback procédural (nav).
    const prog = this.lastProg;
    const trajetSeg = !this.abMode && prog !== null && prog.segment !== null
      && this.trajetActions.has(prog.segment) ? prog.segment : null;
    const dwellZone = !this.abMode && prog !== null && prog.segment === null && prog.restPoint !== 'B'
      && this.zoneWanderActions.has(prog.restPoint) ? prog.restPoint : null;
    if (dwellB) {
      if (!this.dwellBWasActive) {
        // Entrée en zone de nage : capture la position de FIN DE TRAJET avant que le clip ne l'écrase.
        this.transFromPos.copy(creature.position);
        this.transElapsed = 0;
        if (this.animDebugEnabled) {
          console.log(`[SentinelTrace] ✦ arrivée zone B (via ${this.abClipWasActive ? 'trajet AB' : 'autre'}) — wander sched=${this.wanderBAction!.isScheduled() ? 1 : 0} paused=${this.wanderBAction!.paused ? 1 : 0} f${(this.wanderBAction!.time * WANDER_FPS).toFixed(1)}`);
        }
        // FILET DE SÉCURITÉ (ceinture + bretelles) : si on arrive avec wander_B DÉJÀ au-delà de la
        // fenêtre d'accroche (phase résiduelle qu'un chemin de nav imprévu aurait laissée), la
        // capture attendrait un tour complet (~66 s). On la ramène juste avant la fenêtre → capture
        // en <1 s. Sans effet dans le cas normal (nage relancée à f0) ni si l'accroche n'est pas voulue.
        if (this.wanderBAction!.isScheduled()
            && this.wanderBAction!.time > this.accrocheStartTime + this.accrocheDuration) {
          this.wanderBAction!.time = this.accrocheStartTime;
          if (this.animDebugEnabled) console.log(`[SentinelTrace] ⛑ filet: wander_B ramené à f${(this.accrocheStartTime * WANDER_FPS).toFixed(1)}`);
        }
      }
      // ── Accroche (tuto) : BASCULE DIFFÉRÉE, sans AUCUN fondu de pose à l'entrée. L'accroche est
      // le sous-clip 40-55 du MÊME clip que la nage → quand le tuto s'active on laisse wander_B
      // finir sa nage jusqu'à FRANCHIR le MILIEU de la fenêtre (~1 s depuis l'arrivée AB), puis on
      // « capture » la lecture en boucle : pose IDENTIQUE (même clip, même frame) et VITESSE
      // identique (ω démarre au rythme de la nage puis se pose sur le rythme calme du tuto).
      const accrocheWanted = this.accrocheB && this.accrocheAction !== null;
      if (accrocheWanted && !this.accrocheLatched) {
        // Capture au MILIEU RÉEL de la fenêtre (data-driven, en SECONDES du clip wander_B) : le
        // seul endroit où l'oscillation peut égaler la vitesse de la nage (aux bornes, la vitesse
        // d'un cosinus est nulle par construction → freinage net si on capturait là).
        const wT = this.wanderBAction!.time; // LoopRepeat → time déjà wrappé
        if (wT >= this.accrocheStartTime + this.accrocheDuration * 0.5
            && wT <= this.accrocheStartTime + this.accrocheDuration
            && this.wanderBAction!.isRunning()) {
          this.accrocheLatched = true;
          this.accrocheFloatT = 0;
          // Pose EXACTE de la nage, exprimée en s du sous-clip (plus aucune constante théorique).
          const accTime = Math.min(this.accrocheDuration, wT - this.accrocheStartTime);
          const u = this.accrocheDuration > 0 ? accTime / this.accrocheDuration : 0;
          this.accrochePhase = Math.acos(1 - 2 * u); // branche montante
          // Raccord de VITESSE : d(time)/dφ = 0.5·sin(φ)·durée → ω initial tel que d(time)/dt = 1
          // (le rythme de lecture de la nage). Clamp de sécurité si capture trop près d'une borne.
          const dTimeDPhase = 0.5 * Math.sin(this.accrochePhase) * this.accrocheDuration;
          this.accrocheOmega = Math.min(8, dTimeDPhase > 1e-3 ? 1 / dTimeDPhase : 8);
          this.accrocheAction!.reset().play();
          if (this.animDebugEnabled) {
            const wf = wT * WANDER_FPS;
            const af = (this.accrocheStartTime + accTime) * WANDER_FPS;
            console.log(`[SentinelTrace] ✦ CAPTURE @ wander f${wf.toFixed(2)} → acc f${af.toFixed(2)} (écart ${(wf - af).toFixed(3)} f)`
              + ` φ=${this.accrochePhase.toFixed(2)} ω0=${this.accrocheOmega.toFixed(2)} boucle=${this.accrocheDuration.toFixed(3)}s`);
          }
        }
      } else if (!accrocheWanted) {
        this.accrocheLatched = false; // tuto fermé → une réouverture attendra une nouvelle capture
      }
      accroche = accrocheWanted && this.accrocheLatched;

      // ── Poids du fondu accroche : accW pilote les EFFETS (float 3D + regard caméra, entrée et
      // sortie) et le fondu croisé des CLIPS à la SORTIE uniquement — à l'entrée la bascule est
      // directe (pose+vitesse identiques, rien à fondre).
      const accStep = this.accXfadeFrames > 0 ? (dt * WANDER_FPS) / this.accXfadeFrames : 1;
      this.accW = accroche ? Math.min(1, this.accW + accStep) : Math.max(0, this.accW - accStep);
      const accClipW = accroche ? 1 : this.accW; // poids clip : 1 direct dès la capture, fondu en sortie

      if (!accroche && this.accrocheWasActive) {
        // SORTIE (fin du tuto) : la nage REPREND À LA FRAME ÉQUIVALENTE de la pose d'accroche
        // (sous-clip du même clip → pose identique, même vitesse de nage). Surtout PAS de reset()
        // vers la frame 0 (= pose d'arrivée AB, ailleurs dans la zone → c'était le pop de sortie).
        if (!this.wanderBAction!.isScheduled()) this.wanderBAction!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        this.wanderBAction!.paused = false;
        this.wanderBAction!.time = this.accrocheStartTime + this.accrocheAction!.time; // début RÉEL du sous-clip (data-driven)
        if (this.animDebugEnabled) console.log(`[SentinelTrace] ✦ SORTIE accroche → wander_B reprend @ f${(this.wanderBAction!.time * WANDER_FPS).toFixed(1)}`);
      }
      if (accClipW > 0 && this.accrocheAction !== null) {
        // Sous-clip 40↔55 : aller-retour en oscillation COSINUS (vitesse nulle aux extrémités),
        // scrubé à la main (paused + time). Continue PENDANT le fondu de sortie → le mouvement
        // s'efface au lieu de geler. ω relâché exponentiellement vers le rythme calme.
        this.accrocheOmega += (ACCROCHE_OMEGA - this.accrocheOmega) * (1 - Math.exp(-dt / ACCROCHE_OMEGA_SETTLE));
        this.accrochePhase += dt * this.accrocheOmega;
        this.accrocheAction.paused = true;
        this.accrocheAction.time = (0.5 - 0.5 * Math.cos(this.accrochePhase)) * this.accrocheDuration;
        this.accrocheAction.setEffectiveWeight(accClipW);
      } else if (this.accrocheAction?.isScheduled()) {
        this.accrocheAction.stop(); // fondu de sortie terminé → libère l'action
      }

      // Nage wander_B : poids complémentaire (1-accClipW). Via AB elle est DÉJÀ dans le mixer
      // (overlap) mais SCRUBÉE — et une action paused N'EST PAS « running » (isRunning()=false)
      // alors qu'elle EST schedulée : tester isRunning() ici la faisait tomber dans le else →
      // reset() → time=0 → la nage REJOUAIT tout son début (« repasse sur le début du trajet »).
      // isScheduled() + dé-pause = reprise exacte depuis la frame scrubée. Le fondu legacy ne
      // sert qu'à l'arrivée directe CB/DB (action réellement absente du mixer).
      if (this.wanderBAction!.isScheduled()) {
        this.wanderBAction!.paused = false;
        this.wanderBAction!.setEffectiveWeight(1 - accClipW);
      } else {
        if (this.animDebugEnabled) console.log('[SentinelTrace] ⚠ wander_B hors mixer → reset+fadeIn depuis f0 (normal SEULEMENT en arrivée directe CB/DB)');
        this.wanderBAction!.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(WANDER_B_FADE).play();
      }
      if (this.sentinelABAction?.isScheduled()) this.sentinelABAction.stop();
      // Purge des régimes génériques : à l'arrivée via un trajet baké (CB/DB), le clip LoopOnce
      // clampé resterait sinon dans le mixer (poids résiduel → tirerait la pose vers sa dernière
      // frame en permanence) ; idem la nage de la zone quittée si son fondu n'était pas fini.
      this.stopAllTrajets();
      for (const a of this.zoneWanderActions.values()) if (a.isScheduled()) a.stop();

      this.wanderMixer!.update(dt); // applique le blend accroche/nage + avance la nage (auto)

      // Flottement d'accroche EN ESPACE ÉCRAN (repère caméra, comme le yaw de la caméra — c'est
      // pour ça qu'elle, on la règle au degré près). Latéral : la Sentinelle S'INSTALLE lentement
      // vers la carte (montée dédiée ACCROCHE_DRIFT_RISE_S) puis NAVIGUE dans la bande
      // [70 %, 100 %] du max — jamais de retour au centre. Pondéré smoothstep(accW) → la sortie
      // du tuto résorbe tout en douceur pendant le fondu.
      if (this.accW > 0.0001 && this.camera && creature.parent) {
        this.accrocheFloatT += dt;
        const t = this.accrocheFloatT;
        const f = ACCROCHE_FLOAT_FREQ;
        const a = ACCROCHE_FLOAT_AMP;
        const driftW = sentinelSmoothstep(Math.min(1, t / ACCROCHE_DRIFT_RISE_S));
        const oscLat = (Math.sin(t * f[0][0]) + 0.5 * Math.sin(t * f[0][1] + 1.3)) / 1.5; // ∈ [-1, 1]
        const bandMid = (ACCROCHE_DRIFT_BAND_LO + ACCROCHE_DRIFT_BAND_HI) / 2;
        const bandHalf = (ACCROCHE_DRIFT_BAND_HI - ACCROCHE_DRIFT_BAND_LO) / 2;
        const lateral = this.accrocheDrift * (bandMid + bandHalf * oscLat) * driftW;
        const oscDepth = a.z * (Math.sin(t * f[2][0] + 2.1) + 0.5 * Math.sin(t * f[2][1] + 0.4) - ACCROCHE_FLOAT_RAW0.z);
        // Droite/avant CAMÉRA (monde) → directions en espace LOCAL du parent (transformDirection
        // ignore la translation et normalise → amplitudes en unités locales, comme avant).
        this.accMatInv.copy(creature.parent.matrixWorld).invert();
        this.accRightTmp.setFromMatrixColumn(this.camera.matrixWorld, 0).transformDirection(this.accMatInv);
        this.accFwdTmp.setFromMatrixColumn(this.camera.matrixWorld, 2).negate().transformDirection(this.accMatInv);
        this.accrocheFloatOffset
          .copy(this.accRightTmp).multiplyScalar(lateral)
          .addScaledVector(this.accFwdTmp, oscDepth);
        creature.position.addScaledVector(this.accrocheFloatOffset, sentinelSmoothstep(this.accW));
      }

      // Fondu de POSITION trajet→nage : interpole de la fin du trajet vers la pose de nage (cible =
      // clip + flottement), avec un biais vers le trajet. Lisse le raccord à l'arrivée en zone B.
      // Désactivé quand le clip `sentinel_AB` est câblé (le crossfade natif gère le raccord) ; ne
      // sert que de FALLBACK au profil JSON.
      if (!this.sentinelABAction && this.transElapsed < AB_NAGE_TRANS_DUR) {
        this.transElapsed += dt;
        const blend = Math.min(1, this.transElapsed / AB_NAGE_TRANS_DUR);
        const eased = Math.pow(blend, AB_NAGE_TRANS_BIAS); // >1 : reste plus longtemps côté trajet
        this.transTmp.copy(creature.position);             // cible = pose de nage
        creature.position.copy(this.transFromPos).lerp(this.transTmp, eased);
      }

      // Regard caméra (accroche) APRÈS le fondu de position, PONDÉRÉ par smoothstep(accW) : slerp
      // de la rotation du clip vers « face caméra » → l'orientation entre/sort en douceur (vitesse
      // angulaire nulle aux deux bouts), plus de pop.
      if (this.accW > 0.0001 && this.camera) {
        creature.updateMatrixWorld(true);
        this.qPathTmp.copy(creature.quaternion);
        this.camera.getWorldPosition(this.camTmp);
        creature.lookAt(this.camTmp);
        creature.quaternion.slerp(this.qPathTmp, 1 - sentinelSmoothstep(this.accW));
      }
      this.accrocheWasActive = accroche;
      this.dwellBWasActive = true;
    } else if (abClipMode) {
      // ── Trajet AB : clip `sentinel_AB` SCRUBÉ (paused + time manuel), avec OVERLAP vers wander_B
      // piloté par le SCROLL (pas par une durée temporelle). Plus de crossfade natif.
      if (!this.abClipWasActive) {
        // Arête d'ENTRÉE en régime AB. Aller (depuis repos A) → wander_B sera SCRUBÉE sur ses N 1res
        // frames ; retour (depuis la nage B) → wander_B laissée en AUTO pendant son fade (évite un
        // saut de sa position de nage vers le début).
        this.abReturnFromB = this.dwellBWasActive;
        this.sentinelABAction!.enabled = true;
        this.sentinelABAction!.reset();
        this.sentinelABAction!.play();
        if (this.accrocheWasActive) this.accrocheAction?.stop();
        this.accrocheWasActive = false;
        this.accrocheLatched = false;
        this.accW = 0;
      }
      // Scrub chaque frame (ne jamais reset() en cours).
      this.sentinelABAction!.paused = true;
      this.sentinelABAction!.time = this.abFrameToClipTime(this.abFrame);
      // OVERLAP piloté par la progression (auto) du trajet, réglé EN FRAMES : sur les xfadeAbFrames
      // dernières frames du trajet, wander_B monte pendant que sentinel_AB descend (poids sommant à
      // 1 → interpolation propre). À l'ALLER, wander_B est SCRUBÉE sur ses xfadeWanderFrames 1res
      // frames (déterministe, indépendant de la vitesse) puis reprend en auto à l'arrivée (dwellB) ;
      // au RETOUR elle reste en auto.
      const startFrame = AB_CAM_FRAME_END - this.xfadeAbFrames;
      const xfadeW = this.abActive
        ? Math.max(0, Math.min(1, (this.abFrame - startFrame) / this.xfadeAbFrames))
        : 0;
      if (xfadeW > 0) {
        // isScheduled (PAS isRunning) : l'action scrubée est paused ⇒ isRunning()=false ⇒ un
        // reset() se redéclencherait CHAQUE frame (et au retour B→A, figeait la nage à f0).
        if (!this.wanderBAction!.isScheduled()) this.wanderBAction!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        if (!this.abReturnFromB) {
          this.wanderBAction!.paused = true; // aller : scrub des N 1res frames de la nage
          this.wanderBAction!.time = (xfadeW * this.xfadeWanderFrames) / WANDER_FPS;
        }
        this.wanderBAction!.setEffectiveWeight(xfadeW);
      } else if (this.wanderBAction!.isScheduled()) {
        this.wanderBAction!.stop();
      }
      this.sentinelABAction!.setEffectiveWeight(1 - xfadeW);
      this.wanderMixer!.update(dt);

      // Entrée scénarisée PAR-DESSUS la pose du clip : au repos A la créature est garée hors-champ
      // (derrière/au-dessus caméra) puis rejoint le tracé sur les premiers entryCatchUp % (lerp de
      // position, comme le float accroche). L'orientation reste celle du clip (roll/vrilles bakés).
      let entryW = 0;
      if (!this.abActive) entryW = 1;
      else if (this.entryCatchUp > 0) entryW = 1 - sentinelSmoothstep(this.abT / this.entryCatchUp);
      if (entryW > 0.0001 && this.entryCaptured) {
        this.entryLocalTmp.copy(this.entryPointWorld);
        if (creature.parent) creature.parent.worldToLocal(this.entryLocalTmp); // monde → local parent creature
        creature.position.lerp(this.entryLocalTmp, entryW);
      }
      this.dwellBWasActive = false;
    } else if (trajetSeg !== null) {
      // ── TRAJET BAKÉ générique (pilote : BC). Clip scrubé à la progression caméra (time = t·durée,
      // timeline == clip caméra) + DEUX overlaps EN FRAMES :
      //  - DÉPART : la nage de la zone quittée CONTINUE en auto pendant que le trajet monte (poses
      //    différentes → le fondu glisse ; départs bakés lents près du centre de zone exprès) ;
      //  - ARRIVÉE : même mécanique que AB→wander_B (nage de destination scrubée sur ses
      //    xfadeWanderFrames premières frames, poids croisés, reprise auto au dwell).
      const pr = prog!;
      if (this.trajetWasActive !== trajetSeg || this.trajetActive === null) {
        // Arête d'ENTRÉE : choisit la VARIANTE la plus proche de la position courante (les `_v2`/
        // `_v3` partent d'ailleurs dans la boucle de nage), purge les autres, lance le clip en
        // scrub + purge les résidus d'accroche (défensif).
        this.stopAllTrajets();
        const variant = this.pickTrajetVariant(trajetSeg);
        this.trajetActive = variant;
        variant.action.enabled = true;
        variant.action.reset();
        variant.action.play();
        if (this.accrocheAction?.isScheduled()) this.accrocheAction.stop();
        this.accrocheWasActive = false;
        this.accrocheLatched = false;
        this.accW = 0;
        if (this.animDebugEnabled) {
          const d = variant.startPos.distanceTo(creature.position);
          const nVars = this.trajetActions.get(trajetSeg)!.length;
          const forced = this.trajetForcedVariant !== null && this.trajetForcedVariant < nVars;
          console.log(`[SentinelTrace] ✦ départ trajet ${trajetSeg} (${pr.from}→${pr.to}) — ${variant.name}`
            + ` (frame 0 à ${d.toFixed(2)} u, ${nVars} variante${nVars > 1 ? 's' : ''}${forced ? ', FORCÉE dev' : ''})`);
        }
      }
      const action = this.trajetActive!.action; // non-null : posé par l'arête ci-dessus
      const dur = action.getClip().duration;
      const fromWander = this.getZoneWander(pr.from);
      const toWander = this.getZoneWander(pr.to);
      const t = Math.max(0, Math.min(1, pr.t));
      const totalFrames = dur * WANDER_FPS;
      const frame = t * totalFrames;
      action.paused = true; // scrub chaque frame (jamais de reset en cours)
      action.time = t * dur;

      // Overlap DÉPART : nage quittée à poids 1-w, toujours en AUTO (elle finit son mouvement).
      const departW = this.xfadeDepartFrames > 0 ? Math.min(1, frame / this.xfadeDepartFrames) : 1;
      if (fromWander !== null && fromWander !== toWander) {
        if (departW < 1 && fromWander.isScheduled()) {
          fromWander.paused = false;
          fromWander.setEffectiveWeight(1 - departW);
        } else if (fromWander.isScheduled()) {
          fromWander.stop(); // fondu de départ terminé → libère la nage quittée
        }
      }

      // Overlap ARRIVÉE : nage de destination scrubée 0→xfadeWanderFrames (déterministe).
      const arriveStart = totalFrames - this.xfadeAbFrames;
      const arriveW = this.xfadeAbFrames > 0
        ? Math.max(0, Math.min(1, (frame - arriveStart) / this.xfadeAbFrames)) : 0;
      if (toWander !== null) {
        if (arriveW > 0) {
          if (!toWander.isScheduled()) toWander.reset().setLoop(THREE.LoopRepeat, Infinity).play();
          toWander.paused = true;
          toWander.time = (arriveW * this.xfadeWanderFrames) / WANDER_FPS;
          toWander.setEffectiveWeight(arriveW);
        } else if (toWander.isScheduled() && toWander !== fromWander) {
          toWander.stop();
        }
      }

      // Poids du trajet : complément des deux fondus (fenêtres disjointes → somme toujours = 1).
      action.setEffectiveWeight(Math.min(departW, 1 - arriveW));
      if (this.sentinelABAction?.isScheduled()) this.sentinelABAction.stop();
      this.wanderMixer!.update(dt);
      this.dwellBWasActive = false;
    } else if (dwellZone !== null) {
      // ── Repos dans une zone à nage BAKÉE (C, bientôt D) — pendant du dwellB, sans accroche.
      // Via un trajet baké, la nage TOURNE DÉJÀ (overlap d'arrivée, scrubée paused) → reprise en
      // AUTO sans re-fondu ; sinon (arrivée via trajet procédural) démarrage doux en fondu.
      const wander = this.zoneWanderActions.get(dwellZone)!;
      if (this.trajetWasActive !== null && this.animDebugEnabled) {
        console.log(`[SentinelTrace] ✦ arrivée zone ${dwellZone} : wander_${dwellZone} reprend @ f${(wander.time * WANDER_FPS).toFixed(1)}`);
      }
      if (wander.isScheduled()) {
        wander.paused = false;
        wander.setEffectiveWeight(1);
      } else {
        wander.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(WANDER_B_FADE).play();
      }
      // Purge : trajets finis + nages des autres zones.
      this.stopAllTrajets();
      if (this.sentinelABAction?.isScheduled()) this.sentinelABAction.stop();
      if (this.wanderBAction?.isScheduled()) this.wanderBAction.stop();
      for (const [z, a] of this.zoneWanderActions) if (z !== dwellZone && a.isScheduled()) a.stop();
      this.wanderMixer!.update(dt);
      this.dwellBWasActive = false;
    } else {
      if (this.wanderBAction?.isScheduled()) this.wanderBAction.stop();
      this.stopAllTrajets();
      for (const a of this.zoneWanderActions.values()) if (a.isScheduled()) a.stop();
      if (this.accrocheWasActive) this.accrocheAction?.stop(); // sortie d'accroche (paused ⇒ isRunning() faux)
      this.accrocheWasActive = false;
      this.accrocheLatched = false;
      this.accW = 0;
      this.dwellBWasActive = false;
    }
    this.abClipWasActive = abClipMode; // arête AB(clip) ↔ autre (lu au frame suivant pour les crossfades)
    this.trajetWasActive = trajetSeg;  // arête trajet baké ↔ autre (départ/arrivée)

    if (abClipMode || trajetSeg !== null || dwellZone !== null) {
      // Pose déjà appliquée par le mixer (clip trajet/nage bakés) → rien à échantillonner.
      this.lastTurn = 0;
    } else if (this.abMode && this.abProfile) {
      // AB : rejeu du profil baké, calé sur la frame caméra → vitesse ease + vrilles
      // 360° + « passe devant la caméra », synchrones avec le clip caméra.
      const prof = this.abProfile;
      rollExact = sampleABProfile(prof, this.abFrame, this.tmpA); // pos GLB + roll
      // Look-ahead : quelques frames plus loin (sinon, en fin de trajet, recule pour viser)
      sampleABProfile(prof, this.abFrame + AB_LOOK_FRAMES, this.tmpB);
      if (this.tmpB.distanceToSquared(this.tmpA) < 1e-4) {
        sampleABProfile(prof, this.abFrame - AB_LOOK_FRAMES, this.tmpB);
        this.tmpB.subVectors(this.tmpA, this.tmpB).add(this.tmpA);
      }
      // Entrée scénarisée : au repos A, position = point d'entrée (hors-champ, derrière +
      // au-dessus caméra) ; au démarrage AB, fondu smoothstep du point d'entrée → tracé sur
      // les premiers entryCatchUp % (rattrape le retard, masque le saut frame 1→53).
      // La visée (tmpB) reste sur le tracé → la sentinelle plonge « tête la première ».
      let entryW = 0;
      if (!this.abActive) entryW = 1;
      else if (this.entryCatchUp > 0) entryW = 1 - sentinelSmoothstep(this.abT / this.entryCatchUp);
      if (entryW > 0.0001 && this.entryCaptured) {
        this.entryLocalTmp.copy(this.entryPointWorld);
        model.worldToLocal(this.entryLocalTmp); // point d'entrée monde → GLB-local
        this.tmpA.lerp(this.entryLocalTmp, entryW);
        if (rollExact !== null) rollExact *= (1 - entryW); // pas de vrille pendant la plongée
      }
      this.lastTurn = 0;
    } else if (this.abMode) {
      // Fallback (profil non chargé) : ancienne logique courbe AB + ressort
      const tPrev = this.tCurrent;
      this.tCurrent += (this.tTarget - this.tCurrent) * T_SMOOTH;
      const tSpeed = dt > 0 ? Math.abs(this.tCurrent - tPrev) / dt : 0;
      const idleTarget = tSpeed < MOVING_T_SPEED ? 1 : 0;
      this.idleWeight += (idleTarget - this.idleWeight) * IDLE_WEIGHT_SMOOTH;
      this.curve.getPointAt(this.tCurrent, this.tmpA);
      if (this.idleWeight > 0.001) {
        const e = this.elapsed + this.idleSeed;
        this.tmpA.x += Math.sin(e * 0.23) * IDLE_AMP * this.idleWeight;
        this.tmpA.y += Math.sin(e * 0.31 + 1.3) * IDLE_AMP * 0.8 * this.idleWeight;
        this.tmpA.z += Math.sin(e * 0.17 + 2.6) * IDLE_AMP * this.idleWeight;
      }
      if (this.tCurrent < 0.95) {
        this.curve.getPointAt(Math.min(1, this.tCurrent + LOOK_AHEAD), this.tmpB);
      } else {
        this.curve.getTangentAt(0.95, this.tmpB);
        this.tmpB.multiplyScalar(4).add(this.tmpA);
      }
      this.curve.getTangentAt(this.tCurrent, this.tanA);
      this.curve.getTangentAt(Math.min(1, this.tCurrent + BANK_LOOKAHEAD), this.tanB);
      this.tanA.y = 0; this.tanB.y = 0;
      if (this.tanA.lengthSq() > 1e-6 && this.tanB.lengthSq() > 1e-6) {
        this.tanA.normalize(); this.tanB.normalize();
        const crossY = this.tanA.x * this.tanB.z - this.tanA.z * this.tanB.x;
        const turn = Math.asin(Math.max(-1, Math.min(1, crossY)));
        this.lastTurn = turn;
        bankTarget = Math.max(-BANK_MAX, Math.min(BANK_MAX, turn * BANK_GAIN)) * (1 - this.idleWeight);
      }
    } else if (this.nav) {
      // Wander dans la zone B/C/D, ou traverse d'une trajectoire (piloté scroll)
      creature.getWorldPosition(this.navCurPos);
      model.worldToLocal(this.navCurPos); // position courante en GLB-local
      const r = this.nav.computeTarget(dt, this.elapsed, this.navCurPos, this.tmpA, this.tmpB);
      wanderWeight = r.wanderWeight;
      this.lastTurn = r.turn;
      bankTarget = Math.max(-BANK_MAX, Math.min(BANK_MAX, r.turn * BANK_GAIN)) * (1 - wanderWeight);
    } else {
      // Pas de navigateur (fallback) : reste au bout de la courbe AB
      this.curve.getPointAt(1, this.tmpA);
      this.curve.getTangentAt(0.95, this.tmpB);
      this.tmpB.multiplyScalar(4).add(this.tmpA);
    }

    // Application de la pose procédurale — SAUTÉE quand le mixer possède la transform
    // (dwell B/C/D bakés, clip AB, trajet baké).
    if (!dwellB && !abClipMode && trajetSeg === null && dwellZone === null) {
      // ── Espaces : GLB → monde → local du parent de la créature
      model.localToWorld(this.tmpB);
      model.localToWorld(this.tmpA);
      if (creature.parent) creature.parent.worldToLocal(this.tmpA);
      creature.position.copy(this.tmpA);

      // Orientation : regard (path/look) blendé vers « face caméra » en wander
      creature.lookAt(this.tmpB);
      if (wanderWeight > 0.001 && this.camera) {
        this.qPathTmp.copy(creature.quaternion);
        this.camera.getWorldPosition(this.camTmp);
        creature.lookAt(this.camTmp);
        creature.quaternion.slerp(this.qPathTmp, 1 - wanderWeight);
      }

      // ── Roll / banking sur l'axe de vol
      if (rollExact !== null) {
        this.smoothedBank = rollExact;            // AB : roll baké exact (vrilles synchrones)
      } else {
        this.smoothedBank += (bankTarget - this.smoothedBank) * BANK_SMOOTH;
      }
      creature.rotateZ(this.smoothedBank);
    }

    // ── Wiggle (APRÈS le déplacement — les ressorts traînent derrière)
    if (this.wiggles.length > 0) updateWiggles(this.wiggles);

    // Flush pose + wiggle dans les matrices monde → lecteurs aval (eye-clamp, leader-follow, boost).
    creature.updateMatrixWorld(true);

    // ── Collision œil : clamp de la mémoire ressort hors de la sphère
    if (this.collisionWiggles.length > 0 && this.eyeCollisionRadius > 0) {
      creature.getWorldPosition(this.eyeCenterTmp);
      applyEyeCollision(this.collisionWiggles, this.eyeCenterTmp, this.eyeCollisionRadius, this.collTmp);
    }

    // ── Pinces : respiration (rotation ADDITIVE post-wiggle)
    for (const c of this.clawBones) {
      const breath = (Math.sin(this.elapsed * CLAW_BREATH_SPEED + c.armPhase) * 0.5 + 0.5) * CLAW_BREATH;
      c.bone.rotateX(breath);
    }

    // ── SH shader time
    if (this.shUpdateTime) this.shUpdateTime(this.elapsed);

    // ── Leader-follow : déviations de la chaîne leader (espace créature),
    // ré-échantillonnées sur LEADER_SAMPLES points réguliers pour le shader.
    if (this.leaderChain.length > 1 && this.leaderUniforms) {
      for (let i = 0; i < this.leaderChain.length; i++) {
        this.leaderChain[i].getWorldPosition(this.leaderDeltas[i]);
        creature.worldToLocal(this.leaderDeltas[i]);
        this.leaderDeltas[i].sub(this.leaderRestPos[i]);
      }
      const out = this.leaderUniforms.uLeaderDelta.value;
      let j = 0;
      for (let s = 0; s < LEADER_SAMPLES; s++) {
        const t = s / (LEADER_SAMPLES - 1);
        while (j < this.leaderTParams.length - 2 && this.leaderTParams[j + 1] < t) j++;
        const t0 = this.leaderTParams[j];
        const t1 = this.leaderTParams[j + 1];
        const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
        out[s].copy(this.leaderDeltas[j]).lerp(this.leaderDeltas[j + 1], Math.max(0, Math.min(1, f)));
      }
      this.leaderUniforms.uLeaderCount.value = LEADER_SAMPLES;
    }

    // ── Blink
    if (this.lidUpper && this.lidLower) {
      if (this.blinkPhase < 0 && this.elapsed >= this.nextBlinkAt) {
        this.blinkPhase = 0;
        this.pendingDoubleBlink = Math.random() < BLINK_DOUBLE_CHANCE;
      }
      let blinkAmount = 0;
      if (this.blinkPhase >= 0) {
        this.blinkPhase += dt;
        if (this.blinkPhase < BLINK_CLOSE_TIME) {
          blinkAmount = this.blinkPhase / BLINK_CLOSE_TIME;
        } else if (this.blinkPhase < BLINK_CLOSE_TIME + BLINK_OPEN_TIME) {
          blinkAmount = 1 - (this.blinkPhase - BLINK_CLOSE_TIME) / BLINK_OPEN_TIME;
        } else {
          this.blinkPhase = -1;
          if (this.pendingDoubleBlink) {
            this.pendingDoubleBlink = false;
            this.nextBlinkAt = this.elapsed + 0.15;
          } else {
            this.nextBlinkAt = this.elapsed + BLINK_GAP_MIN + Math.random() * (BLINK_GAP_MAX - BLINK_GAP_MIN);
          }
        }
      }
      this.lidUpper.rotation.x = this.lidUpperRestX + blinkAmount * BLINK_UPPER_ANGLE;
      this.lidLower.rotation.x = this.lidLowerRestX + blinkAmount * BLINK_LOWER_ANGLE;
    }

    // ── Iris : scan ambiant + regard dans le virage
    if (this.irisBone) {
      const scanV = Math.sin(this.elapsed * 0.53 + 1.7) * IRIS_SCAN_AMP * 0.6;
      const scanH = Math.sin(this.elapsed * 0.31) * IRIS_SCAN_AMP;
      const yawTarget = Math.max(-IRIS_MAX, Math.min(IRIS_MAX, this.lastTurn * IRIS_TURN_GAIN)) * (1 - this.idleWeight);
      this.smoothedIrisYaw += (yawTarget - this.smoothedIrisYaw) * IRIS_SMOOTH;
      this.irisBone.rotation.x = this.irisRestX + scanV;
      this.irisBone.rotation.z = this.irisRestZ + scanH + this.smoothedIrisYaw;
    }

    // ── Boost SH : vélocité du bout du leader en espace créature (swing seul)
    if (this.leaderTip && this.shSetBoost && dt > 0) {
      this.leaderTip.getWorldPosition(this.tipLocal);
      creature.worldToLocal(this.tipLocal);
      if (!this.tipInitialized) {
        this.prevTipLocal.copy(this.tipLocal);
        this.tipInitialized = true;
      }
      const tipSpeed = this.prevTipLocal.distanceTo(this.tipLocal) / dt;
      this.prevTipLocal.copy(this.tipLocal);
      const rawBoost = Math.min(tipSpeed * BOOST_GAIN, BOOST_MAX);
      this.smoothedBoost += (rawBoost - this.smoothedBoost) * BOOST_SMOOTH;
      this.shSetBoost(this.smoothedBoost);
    }

    // ── Debug d'animation (HUD onglet Anim) : régime courant + poids des actions, émis en throttlé.
    if (this.animDebugEnabled) {
      this.currentRegime = accroche ? 'accroche B'
        : (dwellB && this.accrocheB) ? 'nage → accroche…' // bascule différée : attente de la fenêtre
        : dwellB ? 'nage wander_B'
        : trajetSeg !== null ? `trajet ${this.trajetActive ? this.trajetActive.name.replace(/^sentinel_/, '') : trajetSeg} (clip)`
        : dwellZone !== null ? `nage wander_${dwellZone}`
        : abClipMode ? 'trajet AB (clip)'
        : (this.abMode && this.abProfile) ? 'trajet AB (profil)'
        : this.abMode ? 'trajet AB (courbe)'
        : this.nav ? 'nav / traverse'
        : 'idle';

      // ── Trace console RESSERRÉE sur la zone de capture nage→accroche : de l'approche de la
      // fenêtre (dernier quart avant le milieu réel) jusqu'à 0,5 s après la capture. 1 ligne / 2
      // frames render + VITESSE MESURÉE de la créature (v) — une saccade = un saut de v.
      const accApproach = dwellB && this.accrocheB && !this.accrocheLatched
        && this.wanderBAction !== null
        && this.wanderBAction.time >= this.accrocheStartTime + this.accrocheDuration * 0.25
        && this.wanderBAction.time <= this.accrocheStartTime + this.accrocheDuration;
      if (!this.traceOn && accApproach) {
        this.traceOn = true;
        this.traceTick = 0;
        this.tracePostS = 8; // garde-fou si l'accroche n'est jamais capturée
        this.tracePrevPos.copy(creature.position);
        this.tracePrevT = this.elapsed;
        console.log('[SentinelTrace] ── début de trace (approche de la fenêtre d\'accroche)');
      }
      if (this.traceOn) {
        if (accroche && this.tracePostS > 0.5) this.tracePostS = 0.5; // capturée → encore 0,5 s
        this.traceTick += 1;
        if (this.traceTick % 2 === 1) {
          const dtLog = this.elapsed - this.tracePrevT;
          const v = dtLog > 0 ? creature.position.distanceTo(this.tracePrevPos) / dtLog : 0;
          this.tracePrevPos.copy(creature.position);
          this.tracePrevT = this.elapsed;
          const wSched = this.wanderBAction?.isScheduled() ?? false;
          const aSched = this.accrocheAction?.isScheduled() ?? false;
          console.log(
            `[SentinelTrace] ${this.currentRegime}`
            + ` | wander f${wSched ? (this.wanderBAction!.time * WANDER_FPS).toFixed(2) : '—'} w=${(wSched ? this.wanderBAction!.getEffectiveWeight() : 0).toFixed(2)}`
            + ` | acc f${aSched ? ((this.accrocheStartTime + this.accrocheAction!.time) * WANDER_FPS).toFixed(2) : '—'} w=${(aSched ? this.accrocheAction!.getEffectiveWeight() : 0).toFixed(2)} latch=${this.accrocheLatched ? 1 : 0}`
            + ` | accW=${this.accW.toFixed(2)} ω=${this.accrocheOmega.toFixed(2)}`
            + ` | v=${v.toFixed(2)} u/s`
          );
        }
        this.tracePostS -= dt;
        if (this.tracePostS <= 0) {
          this.traceOn = false;
          console.log('[SentinelTrace] ── fin de trace');
        }
      }
      this.animDebugAccum += dt;
      if (this.animDebugAccum >= 0.05) { // ~20 Hz, suffisant pour l'affichage
        this.animDebugAccum = 0;
        // Poids AFFICHÉS = 0 quand l'action n'est pas dans le mixer (isScheduled) : une action
        // stoppée garde son dernier _effectiveWeight en mémoire → jauges « fantômes » sinon.
        // Barres GÉNÉRIQUES : « trajet » = clip trajet actif (AB ou segment courant) ; « nage » =
        // la plus forte des nages schedulées (B/C/D — pendant les overlaps c'est celle qui joue).
        const trajetAction = trajetSeg !== null ? this.trajetActive?.action ?? null : this.sentinelABAction;
        let wanderW = this.wanderBAction?.isScheduled() ? this.wanderBAction.getEffectiveWeight() : 0;
        for (const a of this.zoneWanderActions.values()) {
          if (a.isScheduled()) wanderW = Math.max(wanderW, a.getEffectiveWeight());
        }
        const hudFrame = trajetSeg !== null && prog !== null && trajetAction !== null
          ? Math.max(0, Math.min(1, prog.t)) * trajetAction.getClip().duration * WANDER_FPS
          : this.abFrame;
        window.dispatchEvent(new CustomEvent('overmind:sentinel-anim', { detail: {
          regime: this.currentRegime,
          ab: trajetAction?.isScheduled() ? trajetAction.getEffectiveWeight() : 0,
          wander: wanderW,
          accroche: this.accrocheAction?.isScheduled() ? this.accrocheAction.getEffectiveWeight() : 0,
          abFrame: hudFrame,
          abT: trajetSeg !== null && prog !== null ? Math.max(0, Math.min(1, prog.t)) : this.abT,
          abFrames: this.xfadeAbFrames,
          wanderFrames: this.xfadeWanderFrames,
        } }));
      }
    }
  }

  /** Remplace la courbe AB (éditeur de courbe live) — la sentinelle suit aussitôt. */
  setCurve(curve: THREE.CurvePath<THREE.Vector3>): void {
    this.curve = curve;
  }

  /** Debug : zones (sphères) + trajectoires (lignes) du navigateur wander. */
  setWanderDebug(opts: { zones?: boolean; trajectories?: boolean }): void {
    this.nav?.setDebug(opts);
  }

  dispose(): void {
    if (this.wiggles.length > 0) disposeWiggles(this.wiggles);
    this.wiggles = [];
    this.collisionWiggles = [];
    this.nav?.dispose();
    this.wanderBAction?.stop();
    this.wanderMixer?.stopAllAction();
    this.wanderMixer = null;
    this.wanderBAction = null;
    this.accrocheAction = null;
    this.creature = null;
  }
}
