
import * as THREE from 'three';
import { ScrollGaugeInput } from './scrollGaugeInput.ts';
import type { HoloCardEntry } from './holoScreenShader.ts';

/** Plage de frames du clip caméra AB dans Blender (ActionAB). */
export const AB_CAM_FRAME_START = 53;
export const AB_CAM_FRAME_END = 500;

/** Offset de position (monde) appliqué à la caméra pendant AB, éditable (frames fStart→fEnd). */
export interface CameraABOffset { fStart: number; fEnd: number; offsets: number[][] }

// ── Types ────────────────────────────────────────────────────────────────────

type AnimatorState = 'dwell' | 'playing' | 'free' | 'reading';
type Direction = 'forward' | 'backward';
export type RestPoint = 'A' | 'B' | 'C' | 'D' | 'E';

interface Segment {
  name: string;
  cameraNode: THREE.PerspectiveCamera;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  duration: number;
  /** Resting point reached when this segment finishes playing forward (timeScale=+1) */
  endRestPoint: RestPoint;
  /** Resting point reached when this segment finishes playing reversed (timeScale=-1) */
  startRestPoint: RestPoint;
  /** Optional FOV animation: ease vertical FOV from start to end across the segment */
  fovStart?: number;
  fovEnd?: number;
  /** Optional FOV curve (normalized t∈[0,1] → yfov degrees) from Cameras_fov_V2.1.json.
   *  When present, overrides fovStart/fovEnd (faithful eased curve baked in Blender). */
  fovCurve?: [number, number][] | null;
}

// V2.1 : clips nommés en codes courts (AB/BC/CD/DC/CB/DB/BD), 1 par trajet. Les 6 arêtes
// du triangle B-C-D ont chacune un clip dédié → plus aucun playback reversed nécessaire.
const SEGMENT_DEFS = [
  // Forward — 3 outbound trips
  { actionName: 'AB', cameraName: 'CameraAB', label: 'AB', from: 'A' as RestPoint, to: 'B' as RestPoint },
  { actionName: 'BC', cameraName: 'CameraBC', label: 'BC', from: 'B' as RestPoint, to: 'C' as RestPoint },
  { actionName: 'CD', cameraName: 'CameraCD', label: 'CD', from: 'C' as RestPoint, to: 'D' as RestPoint },
  // Dedicated return trips (all played forward, timeScale=+1)
  { actionName: 'DC', cameraName: 'CameraDC', label: 'DC', from: 'D' as RestPoint, to: 'C' as RestPoint },
  { actionName: 'CB', cameraName: 'CameraCB', label: 'CB', from: 'C' as RestPoint, to: 'B' as RestPoint, fovStart: 49.426, fovEnd: 70.224 },
  { actionName: 'DB', cameraName: 'CameraDB', label: 'DB', from: 'D' as RestPoint, to: 'B' as RestPoint, fovStart: 49.426, fovEnd: 70.224 },
  { actionName: 'BD', cameraName: 'CameraBD', label: 'BD', from: 'B' as RestPoint, to: 'D' as RestPoint, fovStart: 70.224, fovEnd: 49.426 },
  // Card E — 6 trajets (V2.9.1). ⚠️ le clip s'appelle 'BE', le node caméra 'CameraBE'.
  // Les FOV animées ne s'exportent PAS en glTF → bornes fallback ici (Cameras_fov n'a pas encore
  // les courbes E). Hypothèse E = 70.224° (vue LARGE, miroir de B) : explique le saut observé sur
  // E→B (doit monter à 70.224) ET E→D (doit descendre 70.224→49.426). B/E larges, C/D serrés.
  { actionName: 'BE', cameraName: 'CameraBE', label: 'BE', from: 'B' as RestPoint, to: 'E' as RestPoint, fovStart: 70.224, fovEnd: 70.224 },
  { actionName: 'EB', cameraName: 'CameraEB', label: 'EB', from: 'E' as RestPoint, to: 'B' as RestPoint, fovStart: 70.224, fovEnd: 70.224 },
  { actionName: 'CE', cameraName: 'CameraCE', label: 'CE', from: 'C' as RestPoint, to: 'E' as RestPoint, fovStart: 49.426, fovEnd: 70.224 },
  { actionName: 'EC', cameraName: 'CameraEC', label: 'EC', from: 'E' as RestPoint, to: 'C' as RestPoint, fovStart: 70.224, fovEnd: 49.426 },
  { actionName: 'DE', cameraName: 'CameraDE', label: 'DE', from: 'D' as RestPoint, to: 'E' as RestPoint, fovStart: 49.426, fovEnd: 70.224 },
  { actionName: 'ED', cameraName: 'CameraED', label: 'ED', from: 'E' as RestPoint, to: 'D' as RestPoint, fovStart: 70.224, fovEnd: 49.426 },
] as const;
// NB: fovStart/fovEnd CB/DB/BD = bornes (issues de Cameras_fov_V2.1.json) servant de FALLBACK
// linéaire ; la COURBE complète frame→yfov est chargée via setFovCurves() et a la priorité.

// Index of forward segments in the SEGMENT_DEFS array (used to land/snap at rest points)
const FORWARD_AB = 0;
const FORWARD_BC = 1;
const FORWARD_CD = 2;
const BACKWARD_DC = 3;
const BACKWARD_CB = 4;
// Index 5=DB, 6=BD, 9=CE, 10=EC : clips chargés (via SEGMENT_DEFS) mais hors de la boucle Option A
// → pas de constante d'index (réserve pour d'éventuels sauts directs plus tard).
// Card E (V2.9.1) — indices des trajets réellement utilisés dans la boucle
const SEGMENT_BE = 7;
const SEGMENT_EB = 8;
const SEGMENT_DE = 11;
const SEGMENT_ED = 12;

const EPS = 0.001;

// Mapping: from a rest point, which segment to play forward.
// The forward path is a LOOP after the first AB trip: A→B, then B→C→D→B→C→D→…
const FORWARD_SEGMENT: Record<RestPoint, number | null> = {
  A: FORWARD_AB,  // A → B
  B: FORWARD_BC,  // B → C
  C: FORWARD_CD,  // C → D
  D: SEGMENT_DE,  // D → E (Option A : E s'intercale dans la boucle après D)
  E: SEGMENT_EB,  // E → B (ferme la boucle)
};
// Mapping: from a rest point, which segment to play backward.
// AB is a one-time presentation trip: once we land at B, point A is locked out and we
// stay in the B↔C↔D ring forever. All backward trips use a DEDICATED clip played forward:
//   - B → D : dedicated BD
//   - C → B : dedicated CB
//   - D → C : dedicated DC
const BACKWARD_SEGMENT: Record<RestPoint, number | null> = {
  A: null,
  B: SEGMENT_BE,   // B → E (Option A : retour dans la boucle B→E→D→C→B)
  C: BACKWARD_CB,
  D: BACKWARD_DC,
  E: SEGMENT_ED,   // E → D
};

// Mapping: from a rest point, which card is in focus (null = no card, e.g. point A)
export const POINT_TO_CARD: Record<RestPoint, number | null> = {
  A: null, B: 0, C: 1, D: 2, E: 3,
};

const READING_SCROLL_SENSITIVITY = 0.0008; // offset (0..1) per pixel of wheel deltaY

/** Durée (s) du fondu entrée/sortie du recul caméra (vue élargie). Profil smoothstep,
 *  vitesse nulle aux deux bouts → raccord doux avec le mouvement (lui aussi en smoothstep). */
const REST_VIEW_EASE_SECONDS = 0.55;

/** Look-around souris : au REPOS, la caméra tourne doucement la « tête » vers le bord visé.
 *  Bande active = seulement les ~15-20% extérieurs de l'écran (deadzone centrale large pour
 *  protéger la lecture des cartes), amplitude douce + lissage lent → pas de nausée. */
export interface LookAroundConfig {
  enabled: boolean;
  deadzone: number; // 0..1 : fraction centrale SANS effet (0.65 → bande active ≈ 17.5% par bord)
  maxYaw: number;   // amplitude horizontale max (rad)
  maxPitch: number; // amplitude verticale max (rad)
  response: number; // constante de temps du suivi (s) — plus grand = plus doux/lent
  fade: number;     // constante de temps du fondu entrée/sortie (s) au dwell/trajet
  // Free-look 360° (drag « tirer le monde », V1 desktop) — s'ADDITIONNE au parallax ci-dessus :
  freeSensitivity: number; // rad par PIXEL de drag
  freePitchClamp: number;  // borne du pitch TOTAL (rad) — évite le retournement au zénith
  freeIdleDelay: number;   // s d'inactivité avant le retour auto vers la vue principale
  freeReturnTime: number;  // constante de temps du retour (s) — durée perçue ≈ 2,5×
  freeInertia: number;     // constante de temps de la glisse au relâcher (s) ; 0 = arrêt net
}
const LOOK_AROUND_DEFAULTS: LookAroundConfig = {
  enabled: true,
  deadzone: 0.65,
  maxYaw: THREE.MathUtils.degToRad(18),
  maxPitch: THREE.MathUtils.degToRad(11),
  response: 0.45,
  fade: 0.4,
  freeSensitivity: THREE.MathUtils.degToRad(0.08), // ~150°/traversée d'écran (0.2 = « virulent », retour Paul 2026-07-08)
  freePitchClamp: THREE.MathUtils.degToRad(80),
  freeIdleDelay: 3, // 5→3 s (retour Paul 2026-07-08)
  freeReturnTime: 0.8,
  freeInertia: 0.4,
};

// NewV1.1: the GLB carries ONLY the 6 camera clips. The sentinel creature has no
// baked clips anymore — it is fully driven in JS (wiggle spring-bones + vertex
// shader + path follow), see sentinelCreature/. The animator exposes a progress
// listener so the creature can sync its path position with the camera scroll.

/** Per-frame scroll progress info, consumed by SentinelCreatureSystem. */
export interface ScrollProgress {
  state: AnimatorState;
  restPoint: RestPoint;
  /** Label of the active segment ('AB', 'BC', 'DC'…) or null when not playing */
  segment: string | null;
  /** 0..1 along the active clip in its authored direction (AB reversed: t decreases) */
  t: number;
  /** Trip start rest point (where this trip began). When dwelling: = restPoint. */
  from: RestPoint;
  /** Trip destination rest point (where this trip is heading). When dwelling: = restPoint.
   *  Lets the sentinel map a trip → wander trajectory + direction unambiguously. */
  to: RestPoint;
}

/** Cubic ease in/out (smoothstep) for FOV transitions on CB and DB */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Replie un angle dans [-π, π] — le retour auto du free-look prend ainsi le chemin le plus
 *  court après un tour complet (±2π = même quaternion → le repli est invisible à l'écran). */
function wrapAngle(a: number): number {
  return THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
}

/** Échantillonne une courbe [t,deg] (t croissant, ∈[0,1]) en interpolation linéaire par morceaux.
 *  La courbe encode déjà l'easing (Bézier baké côté Blender) → pas de smoothstep supplémentaire. */
function sampleFovCurve(curve: [number, number][], t: number): number {
  const x = Math.max(0, Math.min(1, t));
  if (x <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    if (x <= curve[i][0]) {
      const [t0, v0] = curve[i - 1];
      const [t1, v1] = curve[i];
      const f = t1 > t0 ? (x - t0) / (t1 - t0) : 0;
      return v0 + (v1 - v0) * f;
    }
  }
  return last[1];
}

/** Forme du JSON Cameras_fov_V2.1.json (FOV animé non exportable en glTF). */
export interface FovCurvesData {
  clips?: Record<string, { frameStart: number; frameEnd: number; fov: [number, number][] }>;
}

/** Facteur de bord signé : 0 dans la deadzone, →±1 en approchant du bord (smoothstep). */
function edgeFactor(v: number, deadzone: number): number {
  const a = Math.abs(v);
  if (a <= deadzone) return 0;
  const t = Math.min(1, (a - deadzone) / (1 - deadzone));
  return Math.sign(v) * (t * t * (3 - 2 * t));
}

// ── Class ────────────────────────────────────────────────────────────────────

export class ScrollCameraAnimator {
  private mainCamera: THREE.PerspectiveCamera;
  private model: THREE.Object3D;
  private segments: Segment[] = [];
  private state: AnimatorState = 'dwell';
  private lastRestPoint: RestPoint = 'A';
  // Current trip endpoints (for ScrollProgress.from/to → sentinel wander mapping)
  private tripFrom: RestPoint = 'A';
  private tripTo: RestPoint = 'A';
  private activeAction: THREE.AnimationAction | null = null;
  private activeDirection: Direction = 'forward';
  private gauge: ScrollGaugeInput;
  // DEV : frame de lancement du trajet AB (53 = normal ; >53 → saute plus loin pour itérer sur la fin).
  private abStartFrame = AB_CAM_FRAME_START;

  // Scroll progress listener (drives the live sentinel creature)
  private progressListener: ((p: ScrollProgress) => void) | null = null;

  // Reading mode
  private cardEntries: HoloCardEntry[] = [];
  private readingCardIdx: number | null = null;
  private textOffsets: number[] = [0, 0, 0, 0, 0, 0]; // un offset par carte (aligné sur les 6 CARD_CONTENTS ; carte E = index 3)

  // Vue élargie au repos (B/C/D) : recul caméra (le long de l'axe vue) + FOV.
  // back=0 & fov=0 → aucun changement. Réglable en live via setRestView (DevPanel).
  // V2.2 : le dolly-back C/D est désormais BAKÉ dans les poses de repos du GLB (Blender) → back=0 partout.
  private restView: Record<RestPoint, { back: number; fov: number }> = {
    A: { back: 0, fov: 0 }, B: { back: 0, fov: 0 }, C: { back: 0, fov: 0 }, D: { back: 0, fov: 0 }, E: { back: 0, fov: 0 },
  };
  private restBasePos = new THREE.Vector3();   // pose de repos « brute » (sortie de clip)
  private restBaseQuat = new THREE.Quaternion();
  private restBaseFov = 45;
  private restOffset = new THREE.Vector3();    // vecteur recul (monde) = restLocalZ * back
  private restFovDelta = 0;                    // FOV reculé - FOV base
  private restWeight = 0;                       // poids courant du recul (0→1, lissé)
  private restWeightTarget = 0;                 // cible : 1 au repos, 0 en trajet
  private restLocalZ = new THREE.Vector3();

  // Offset de trajectoire caméra sur AB (édité via CameraPathEditor, appliqué en monde).
  private camABOffset: CameraABOffset | null = null;

  // Look-around souris (rotation douce de la « tête » caméra au repos).
  private look: LookAroundConfig = { ...LOOK_AROUND_DEFAULTS };
  private lookNdcX = 0;
  private lookNdcY = 0;
  private lookYaw = 0;     // angle lissé courant (rad)
  private lookPitch = 0;
  private lookYawBias = 0;       // biais yaw lissé (cadrage onboarding, rad)
  private lookYawBiasTarget = 0; // cible du biais (rad ; + = gauche, même sens que la souris)
  private navigationLocked = false; // onboarding : bloque les transitions de zone (canGo* → false)
  private lookWeight = 0;  // 0 en trajet/lecture, 1 au repos (lissé)
  private lookQYaw = new THREE.Quaternion();
  private lookQPitch = new THREE.Quaternion();
  private lookUp = new THREE.Vector3(0, 1, 0);
  private lookRight = new THREE.Vector3(1, 0, 0);
  // Free-look 360° (drag « tirer le monde ») : offsets ACCUMULÉS, additifs au parallax + biais.
  private freeYaw = 0;
  private freePitch = 0;
  private freeVelYaw = 0;      // vitesse lissée (rad/s) pendant le drag → glisse au relâcher
  private freeVelPitch = 0;
  private freeDragYawAcc = 0;  // deltas du drag déposés depuis la dernière frame (rad)
  private freeDragPitchAcc = 0;
  private freeDragging = false;
  private freeIdleT = 0;       // s depuis la dernière activité souris (drag ou déplacement)
  private freeIdleDelayOverride: number | null = null; // tuto B : retour raccourci
  private freeSwept = 0;       // px cumulés de drag « regarder autour » (validation étape free-look du tuto)
  private freeReturnForced = false; // scroll sur une vue déviée → force le retour immédiat (ignore l'inactivité)

  // Pre-allocated temps (zero alloc in update loop)
  private tmpMat = new THREE.Matrix4();

  constructor(
    mainCamera: THREE.PerspectiveCamera,
    model: THREE.Object3D,
    animations: THREE.AnimationClip[],
  ) {
    this.mainCamera = mainCamera;
    this.model = model;

    // Build camera segments by matching cameras and clips by name.
    for (const def of SEGMENT_DEFS) {
      const cam = model.getObjectByName(def.cameraName) as THREE.PerspectiveCamera | undefined;
      const clip = THREE.AnimationClip.findByName(animations, def.actionName);

      if (!cam || !clip) {
        console.warn(`[ScrollCameraAnimator] Missing camera or clip:`, {
          camera: def.cameraName, clip: def.actionName, foundCam: !!cam, foundClip: !!clip,
        });
        continue;
      }

      // Normalize clip times to start at 0 (Blender NLA exports preserve absolute timeline times)
      let minTime = Infinity;
      for (const track of clip.tracks) {
        if (track.times.length > 0 && track.times[0] < minTime) {
          minTime = track.times[0];
        }
      }
      let normalizedClip = clip;
      if (minTime > 0 && minTime !== Infinity) {
        const newTracks = clip.tracks.map(track => {
          const newTimes = new Float32Array(track.times.length);
          for (let i = 0; i < track.times.length; i++) {
            newTimes[i] = track.times[i] - minTime;
          }
          const TrackCtor = track.constructor as new (name: string, times: ArrayLike<number>, values: ArrayLike<number>) => THREE.KeyframeTrack;
          return new TrackCtor(track.name, newTimes, track.values);
        });
        normalizedClip = new THREE.AnimationClip(clip.name, -1, newTracks);
      }

      // Dedicated mixer per clip — no time pollution
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(normalizedClip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;

      const seg: Segment = {
        name: def.label,
        cameraNode: cam,
        mixer,
        action,
        duration: normalizedClip.duration,
        startRestPoint: def.from,
        endRestPoint: def.to,
        fovStart: 'fovStart' in def ? def.fovStart : undefined,
        fovEnd: 'fovEnd' in def ? def.fovEnd : undefined,
      };
      this.segments.push(seg);
      console.log(`[ScrollCameraAnimator] Loaded ${def.label}: ${def.from}→${def.to}, duration=${normalizedClip.duration.toFixed(2)}s (offset=${minTime.toFixed(2)}s)`);
    }

    // Debug: list ALL animation clip names (NewV1.1 should carry exactly the 6 camera clips)
    console.log('[ScrollCameraAnimator] All clip names in GLB:', animations.map(a => a.name));

    if (this.segments.length === 0) {
      console.warn('[ScrollCameraAnimator] No valid segments found, animator disabled');
    } else {
      // Snap to point A
      this.snapToRestPoint('A');
    }

    // Create input gauge
    this.gauge = new ScrollGaugeInput({
      onForward: () => this.triggerForward(),
      onBackward: () => this.triggerBackward(),
      onTextScroll: (dy) => this.scrollText(dy),
      getState: () => this.state,
      canFwd: () => this.canGoForward(),
      canBack: () => this.canGoBackward(),
      isFreeLookNeutral: () => this.isFreeLookNeutral(),
      requestFreeLookReturn: () => this.requestFreeLookReturn(),
    });
  }

  // ── Reading mode ───────────────────────────────────────────────────────

  setCardEntries(entries: HoloCardEntry[]): void {
    this.cardEntries = entries;
  }

  /** Injecte les courbes de FOV animé (Cameras_fov_V2.1.json). Pour chaque clip (BD/CB/DB),
   *  on normalise les frames en t∈[0,1] et on stocke la courbe sur le segment correspondant.
   *  Elle prend alors la priorité sur fovStart/fovEnd lors du trajet. */
  setFovCurves(data: FovCurvesData): void {
    const clips = data?.clips;
    if (!clips) return;
    for (const seg of this.segments) {
      const c = clips[seg.name];
      if (!c || !Array.isArray(c.fov) || c.fov.length < 2) continue;
      const span = c.frameEnd - c.frameStart;
      seg.fovCurve = span > 0
        ? c.fov.map(([f, deg]) => [(f - c.frameStart) / span, deg] as [number, number])
        : null;
    }
  }

  getState(): AnimatorState {
    return this.state;
  }

  getLastRestPoint(): RestPoint {
    return this.lastRestPoint;
  }

  enterReading(cardIdx: number): void {
    if (this.state !== 'dwell') return;
    this.state = 'reading';
    this.readingCardIdx = cardIdx;
    this.gauge.reset();
    this.dispatchReading();
    this.dispatchUpdate();
  }

  exitReading(): void {
    if (this.state !== 'reading') return;
    this.state = 'dwell';
    this.readingCardIdx = null;
    this.dispatchReading();
    this.dispatchUpdate();
  }

  scrollText(deltaY: number): void {
    if (this.state !== 'reading' || this.readingCardIdx === null) return;
    const entry = this.cardEntries[this.readingCardIdx];
    if (!entry) return;
    const viewportFrac = (entry.material.uniforms['uViewportFrac']?.value as number) ?? 0.34;
    const maxOffset = Math.max(0, 1 - viewportFrac);
    const next = Math.max(0, Math.min(maxOffset, this.textOffsets[this.readingCardIdx] + deltaY * READING_SCROLL_SENSITIVITY));
    this.textOffsets[this.readingCardIdx] = next;
    entry.material.uniforms['uTextOffset'].value = next;
    this.dispatchReading();
  }

  setHoverCard(cardIdx: number | null): void {
    for (let i = 0; i < this.cardEntries.length; i++) {
      const target = (cardIdx === this.cardEntries[i].cardIdx) ? 1 : 0;
      this.cardEntries[i].material.uniforms['uHoverGlow'].value = target;
    }
  }

  jumpToPoint(point: RestPoint): void {
    if (this.state === 'reading') {
      this.readingCardIdx = null;
    }
    if (this.activeAction) {
      this.activeAction.paused = true;
      this.activeAction = null;
    }
    this.lastRestPoint = point;
    this.snapToRestPoint(point);
    this.resetFreeLook(); // téléportation : on repart vue droite (le CRT masque le snap)
    this.state = 'dwell';
    this.gauge.reset();
    this.dispatchReading();
    this.dispatchUpdate();
  }

  /** Direction « avant » de l'orientation de REPOS courante (SANS free-look). Sert à ancrer le
   *  point de lancement de la Sentinelle : indépendant de là où l'utilisateur regarde. */
  getRestForward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, -1).applyQuaternion(this.restBaseQuat);
  }

  /** Remet le free-look 360° à zéro (téléportation NavArc → vue principale nette). */
  resetFreeLook(): void {
    this.freeYaw = 0;
    this.freePitch = 0;
    this.freeVelYaw = 0;
    this.freeVelPitch = 0;
    this.freeDragYawAcc = 0;
    this.freeDragPitchAcc = 0;
    this.freeDragging = false;
    this.freeIdleT = 0;
  }

  // ── Update (called every frame) ────────────────────────────────────────

  update(delta: number): void {
    if (this.state === 'free') return;
    if (this.state === 'reading') return;

    this.gauge.update(delta);

    // Lissage du poids de recul (vue élargie) : fondu vers la cible, profil smoothstep.
    if (REST_VIEW_EASE_SECONDS > 0) {
      const step = delta / REST_VIEW_EASE_SECONDS;
      if (this.restWeight < this.restWeightTarget) this.restWeight = Math.min(this.restWeightTarget, this.restWeight + step);
      else if (this.restWeight > this.restWeightTarget) this.restWeight = Math.max(this.restWeightTarget, this.restWeight - step);
    } else {
      this.restWeight = this.restWeightTarget;
    }
    const sw = smoothstep(this.restWeight);

    if (this.state === 'playing' && this.activeAction) {
      const segment = this.findSegmentByAction(this.activeAction);
      if (segment) {
        segment.mixer.update(delta);

        // Copy source camera transform to main camera
        const source = segment.cameraNode;
        source.updateMatrixWorld(true);
        this.mainCamera.position.setFromMatrixPosition(source.matrixWorld);
        this.tmpMat.extractRotation(source.matrixWorld);
        this.mainCamera.quaternion.setFromRotationMatrix(this.tmpMat);

        // FOV animé (les FocalAction ne s'exportent pas en glTF) : courbe baked si dispo
        // (Cameras_fov_V2.1.json), sinon fallback linéaire fovStart→fovEnd, sinon fov du nœud.
        let targetFov = source.fov;
        const ft = segment.duration > 0 ? Math.max(0, Math.min(1, this.activeAction.time / segment.duration)) : 0;
        if (segment.fovCurve) {
          targetFov = sampleFovCurve(segment.fovCurve, ft);
        } else if (segment.fovStart !== undefined && segment.fovEnd !== undefined) {
          targetFov = segment.fovStart + (segment.fovEnd - segment.fovStart) * smoothstep(ft);
        }

        // Recul résiduel pendant le fondu de SORTIE (on quitte un point reculé) : offset
        // additif décroissant sur la pose du clip → départ continu, sans saut.
        if (sw > 0.0001) {
          this.mainCamera.position.addScaledVector(this.restOffset, sw);
          targetFov += this.restFovDelta * sw;
        }

        // Offset de trajectoire caméra édité (AB uniquement), additif en monde.
        if (this.camABOffset && segment.name === 'AB') {
          const tn = segment.duration > 0 ? Math.max(0, Math.min(1, this.activeAction.time / segment.duration)) : 0;
          this.applyCamABOffset(tn);
        }

        if (Math.abs(targetFov - this.mainCamera.fov) > 0.01) {
          this.mainCamera.fov = targetFov;
          this.mainCamera.updateProjectionMatrix();
        }

        // Detect end of clip
        const time = this.activeAction.time;
        if (this.activeDirection === 'forward' && time >= segment.duration - EPS) {
          this.onClipFinished('forward');
        } else if (this.activeDirection === 'backward' && time <= EPS) {
          this.onClipFinished('backward');
        }
      }
    } else if (this.state === 'dwell') {
      // Au repos : pose = base + recul*poids (fondu d'ENTRÉE smoothstep à l'arrivée).
      // On rétablit le quaternion de base chaque frame → base propre pour le look-around
      // (sinon la rotation s'accumulerait, le dwell ne réécrivant pas l'orientation).
      this.mainCamera.quaternion.copy(this.restBaseQuat);
      this.mainCamera.position.copy(this.restBasePos).addScaledVector(this.restOffset, sw);
      const newFov = this.restBaseFov + this.restFovDelta * sw;
      if (Math.abs(newFov - this.mainCamera.fov) > 0.001) {
        this.mainCamera.fov = newFov;
        this.mainCamera.updateProjectionMatrix();
      }
    }

    this.applyLookAround(delta);
    this.notifyProgress();
    this.dispatchUpdate();
  }

  /** Tourne légèrement la « tête » caméra vers le bord visé par la souris. Doux, deadzone
   *  centrale, actif seulement au repos (fondu sinon). Yaw en espace MONDE (horizon stable),
   *  pitch en local. Appliqué après la pose du clip/repos → toujours absolu (pas d'accumulation). */
  private applyLookAround(delta: number): void {
    // Poids cible : 1 au repos si activé, sinon 0 (fondu doux).
    const wTarget = (this.state === 'dwell' && this.look.enabled) ? 1 : 0;
    if (this.look.fade > 0) {
      this.lookWeight += (wTarget - this.lookWeight) * (1 - Math.exp(-delta / this.look.fade));
    } else {
      this.lookWeight = wTarget;
    }

    // Cibles d'angle depuis la souris (droite écran → regarde à droite ; haut → regarde en haut).
    const yawTarget = -edgeFactor(this.lookNdcX, this.look.deadzone) * this.look.maxYaw;
    const pitchTarget = edgeFactor(this.lookNdcY, this.look.deadzone) * this.look.maxPitch;
    const k = this.look.response > 0 ? 1 - Math.exp(-delta / this.look.response) : 1;
    this.lookYaw += (yawTarget - this.lookYaw) * k;
    this.lookPitch += (pitchTarget - this.lookPitch) * k;
    this.lookYawBias += (this.lookYawBiasTarget - this.lookYawBias) * k;

    // ── Free-look 360° : intègre les deltas déposés par le drag (même à 0 bouton tenu : la
    // vitesse lissée décroît alors → relâcher immobile = pas de glisse), sinon glisse amortie
    // (inertie), puis RETOUR AUTO vers la vue principale après freeIdleDelay sans activité.
    this.freeYaw += this.freeDragYawAcc;
    this.freePitch += this.freeDragPitchAcc;
    if (this.freeDragging) {
      if (delta > 0) {
        const kv = 1 - Math.exp(-delta / 0.08); // lissage court de la vitesse instantanée
        this.freeVelYaw += (this.freeDragYawAcc / delta - this.freeVelYaw) * kv;
        this.freeVelPitch += (this.freeDragPitchAcc / delta - this.freeVelPitch) * kv;
      }
    } else if (this.look.freeInertia > 0
        && (Math.abs(this.freeVelYaw) > 1e-3 || Math.abs(this.freeVelPitch) > 1e-3)) {
      this.freeYaw += this.freeVelYaw * delta;
      this.freePitch += this.freeVelPitch * delta;
      const dv = Math.exp(-delta / this.look.freeInertia);
      this.freeVelYaw *= dv;
      this.freeVelPitch *= dv;
    } else {
      this.freeVelYaw = 0;
      this.freeVelPitch = 0;
    }
    this.freeDragYawAcc = 0;
    this.freeDragPitchAcc = 0;
    this.freeYaw = wrapAngle(this.freeYaw); // invisible (±2π) mais garantit le retour court
    this.freePitch = THREE.MathUtils.clamp(this.freePitch, -this.look.freePitchClamp, this.look.freePitchClamp);
    if (!this.freeDragging) {
      this.freeIdleT += delta;
      const idleDelay = this.freeIdleDelayOverride ?? this.look.freeIdleDelay;
      // Retour auto après inactivité — OU forcé immédiatement quand l'utilisateur tente de scroller
      // alors que la vue est déviée (sinon un simple mouvement de souris réarmerait sans cesse l'attente).
      if ((this.freeReturnForced || this.freeIdleT >= idleDelay) && this.look.freeReturnTime > 0) {
        const dr = Math.exp(-delta / this.look.freeReturnTime);
        this.freeYaw *= dr;
        this.freePitch *= dr;
        if (Math.abs(this.freeYaw) < 1e-3 && Math.abs(this.freePitch) < 1e-3) this.freeReturnForced = false;
      }
    }

    const w = smoothstep(this.lookWeight);
    const yaw = (this.lookYaw + this.lookYawBias + this.freeYaw) * w;
    const pitch = THREE.MathUtils.clamp(this.lookPitch + this.freePitch,
      -this.look.freePitchClamp, this.look.freePitchClamp) * w;
    if (Math.abs(yaw) < 1e-5 && Math.abs(pitch) < 1e-5) return;

    // Yaw autour de l'axe MONDE Y (premultiply) → pas de roulis, horizon stable.
    this.lookQYaw.setFromAxisAngle(this.lookUp, yaw);
    this.mainCamera.quaternion.premultiply(this.lookQYaw);
    // Pitch autour de l'axe LOCAL droit (multiply).
    this.lookQPitch.setFromAxisAngle(this.lookRight, pitch);
    this.mainCamera.quaternion.multiply(this.lookQPitch);
  }

  /** Position souris NDC (-1..1) — alimentée chaque frame par la boucle d'animation. Un
   *  déplacement réel réarme le chrono d'inactivité du free-look (« aucune activité » = retour). */
  setPointerNDC(x: number, y: number): void {
    if (Math.abs(x - this.lookNdcX) > 0.002 || Math.abs(y - this.lookNdcY) > 0.002) this.freeIdleT = 0;
    this.lookNdcX = x;
    this.lookNdcY = y;
  }

  /** Free-look : début de drag (déclenché par freeLookDrag après le seuil anti-clic). */
  beginLookDrag(): void {
    this.freeDragging = true;
    this.freeIdleT = 0;
    this.freeVelYaw = 0;
    this.freeVelPitch = 0;
    this.freeReturnForced = false; // un nouveau drag annule un retour forcé en cours
  }

  /** Free-look : deltas de drag en PIXELS. Sens « tirer le monde » : glisser à droite (dx>0) →
   *  le décor suit → on regarde à GAUCHE (yaw+, même convention que le biais onboarding) ;
   *  glisser vers le bas (dy>0) → on regarde en HAUT (pitch+). Déposés ici, intégrés dans
   *  applyLookAround (où delta est connu — la vitesse lissée y sert d'inertie au relâcher). */
  applyLookDragDelta(dxPx: number, dyPx: number): void {
    if (!this.freeDragging) return;
    this.freeDragYawAcc += dxPx * this.look.freeSensitivity;
    this.freeDragPitchAcc += dyPx * this.look.freeSensitivity;
    this.freeSwept += Math.abs(dxPx) + Math.abs(dyPx); // amplitude de geste (tuto free-look)
    this.freeIdleT = 0;
  }

  /** Free-look : fin de drag — la vitesse lissée courante devient la glisse amortie (inertie). */
  endLookDrag(): void {
    this.freeDragging = false;
    this.freeIdleT = 0;
  }

  /** Override du délai de retour auto du free-look (onboarding : 3 s pendant le tuto B) ;
   *  null = retour au réglage normal (config.freeIdleDelay). */
  setFreeLookIdleDelay(seconds: number | null): void {
    this.freeIdleDelayOverride = seconds;
  }

  /** Onboarding (étape « regarder autour ») : amplitude cumulée de drag free-look en pixels.
   *  Sert à valider que l'utilisateur a bien essayé le clic-glisser. */
  getFreeLookSwept(): number { return this.freeSwept; }
  resetFreeLookSwept(): void { this.freeSwept = 0; }

  /** True si le free-look (drag « tourner la caméra ») est revenu à la vue neutre : yaw/pitch ≈ 0
   *  et aucun drag en cours. Sert à bloquer la navigation tant que l'utilisateur n'est pas « rentré ». */
  isFreeLookNeutral(): boolean {
    const EPS = 0.02; // rad (~1.1°) : en-deçà, on considère la vue revenue au point d'origine
    return !this.freeDragging && Math.abs(this.freeYaw) < EPS && Math.abs(this.freePitch) < EPS;
  }

  /** Demande le retour immédiat de la vue déviée (appelé quand l'utilisateur scrolle alors que la
   *  caméra n'est pas neutre) — bypass le délai d'inactivité ET l'activité souris. */
  requestFreeLookReturn(): void { this.freeReturnForced = true; }

  /** Onboarding (étape « bords d'écran ») : intensité de bord courante (0..1) = à quel point la
   *  souris est engagée dans une bande de bord (au-delà de la deadzone). Valide « approcher un bord ». */
  getEdgeReach(): number {
    return Math.max(
      Math.abs(edgeFactor(this.lookNdcX, this.look.deadzone)),
      Math.abs(edgeFactor(this.lookNdcY, this.look.deadzone)),
    );
  }

  /** Règle le look-around souris (live, DevPanel). */
  setLookConfig(cfg: Partial<LookAroundConfig>): void {
    Object.assign(this.look, cfg);
  }

  /** Biais de cadrage onboarding : décale le regard AU REPOS de `deg` degrés (positif = gauche,
   *  même sens que la souris). 0 = neutre. Appliqué doucement via le lissage `response` existant.
   *  La souris reste libre de s'ajouter par-dessus. */
  setLookYawBias(deg: number): void {
    this.lookYawBiasTarget = THREE.MathUtils.degToRad(deg);
  }

  /** Verrou de navigation (onboarding) : quand actif, `canGoForward/Backward` renvoient false →
   *  impossible de quitter le point de repos courant. Piloté par l'onboardingMachine. */
  setNavigationLocked(locked: boolean): void {
    this.navigationLocked = locked;
  }
  isNavigationLocked(): boolean {
    return this.navigationLocked;
  }

  /** Remet l'accumulateur de molette à zéro (ex. après la fermeture de l'onboarding). */
  resetScrollAccumulator(): void {
    this.gauge.reset();
  }

  /** True quand une carte est en mode lecture (le scroll défile l'écran, pas la navigation). */
  isReading(): boolean {
    return this.state === 'reading';
  }

  getLookConfig(): LookAroundConfig {
    return { ...this.look };
  }

  /** Capture la pose de repos « brute » et calcule le recul (vue élargie).
   *  instant=true → applique le recul immédiatement (snap/jump) ; sinon fondu d'entrée. */
  private captureRestBase(instant = false): void {
    this.restBasePos.copy(this.mainCamera.position);
    this.restBaseQuat.copy(this.mainCamera.quaternion);
    this.restBaseFov = this.mainCamera.fov;
    this.computeRestTarget();
    this.restWeightTarget = 1;
    if (instant) this.restWeight = 1;
  }

  /** Recalcule l'offset de recul (monde) + le delta FOV depuis la base + le réglage du point. */
  private computeRestTarget(): void {
    const v = this.restView[this.lastRestPoint];
    this.restLocalZ.set(0, 0, 1).applyQuaternion(this.restBaseQuat); // +Z local = arrière caméra
    this.restOffset.copy(this.restLocalZ).multiplyScalar(v.back);
    this.restFovDelta = (v.fov > 0 ? v.fov : this.restBaseFov) - this.restBaseFov;
  }

  /** Règle la vue élargie d'un point de repos (recul + FOV). Réappliqué en live si on y est. */
  setRestView(point: RestPoint, cfg: { back?: number; fov?: number }): void {
    const v = this.restView[point];
    if (cfg.back !== undefined) v.back = cfg.back;
    if (cfg.fov !== undefined) v.fov = cfg.fov;
    if (this.state === 'dwell' && this.lastRestPoint === point) this.computeRestTarget();
  }

  /** Export des réglages de vue (pour figer dans le code). */
  getRestViews(): Record<RestPoint, { back: number; fov: number }> {
    return this.restView;
  }

  /** Injecte/retire l'offset de trajectoire caméra sur AB (édition live ou valeurs figées). */
  setCameraABOffset(data: CameraABOffset | null): void {
    this.camABOffset = data;
  }

  getCameraABOffset(): CameraABOffset | null {
    return this.camABOffset;
  }

  /** Ajoute l'offset (monde, interpolé par frame) à la caméra pendant AB. */
  private applyCamABOffset(tNorm: number): void {
    const off = this.camABOffset;
    if (!off) return;
    const f = AB_CAM_FRAME_START + tNorm * (AB_CAM_FRAME_END - AB_CAM_FRAME_START);
    if (f < off.fStart || f > off.fEnd) return;
    const idx = f - off.fStart;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, off.offsets.length - 1);
    const a = idx - i0;
    const o0 = off.offsets[i0];
    const o1 = off.offsets[i1];
    if (!o0 || !o1) return;
    this.mainCamera.position.x += o0[0] + (o1[0] - o0[0]) * a;
    this.mainCamera.position.y += o0[1] + (o1[1] - o0[1]) * a;
    this.mainCamera.position.z += o0[2] + (o1[2] - o0[2]) * a;
  }

  /** Register the per-frame scroll progress listener (used by the sentinel creature). */
  setProgressListener(cb: ((p: ScrollProgress) => void) | null): void {
    this.progressListener = cb;
  }

  private notifyProgress(): void {
    if (!this.progressListener) return;
    let segment: string | null = null;
    let t = 0;
    if (this.state === 'playing' && this.activeAction) {
      const seg = this.findSegmentByAction(this.activeAction);
      if (seg) {
        segment = seg.name;
        t = seg.duration > 0 ? Math.max(0, Math.min(1, this.activeAction.time / seg.duration)) : 0;
      }
    }
    // While playing, expose the trip endpoints; while dwelling, from=to=current point.
    const from = this.state === 'playing' ? this.tripFrom : this.lastRestPoint;
    const to = this.state === 'playing' ? this.tripTo : this.lastRestPoint;
    this.progressListener({ state: this.state, restPoint: this.lastRestPoint, segment, t, from, to });
  }

  // ── State transitions ──────────────────────────────────────────────────

  private onClipFinished(dir: Direction): void {
    if (!this.activeAction) return;
    const segment = this.findSegmentByAction(this.activeAction);
    if (!segment) return;

    this.activeAction.paused = true;
    this.activeAction.timeScale = 1;

    // Determine landing rest point.
    //   - Dedicated backward segments (DC, CB, DB) are always played forward (timeScale=+1)
    //     so 'forward' direction here lands on segment.endRestPoint.
    //   - Forward segments played backward (e.g. AB reversed for B→A) land on startRestPoint.
    if (dir === 'forward') {
      this.lastRestPoint = segment.endRestPoint;
    } else {
      this.lastRestPoint = segment.startRestPoint;
    }

    this.state = 'dwell';
    this.activeAction = null;
    this.gauge.reset();
    this.captureRestBase(); // arrivée → applique la vue élargie (recul lissé)
  }

  /** DEV : règle la frame de lancement du trajet AB (clamp 53→499 ; 53 = comportement normal). */
  setABStartFrame(frame: number): void {
    this.abStartFrame = Math.max(AB_CAM_FRAME_START, Math.min(AB_CAM_FRAME_END - 1, Math.round(frame)));
  }

  triggerForward(): void {
    if (this.state !== 'dwell') return;
    const idx = FORWARD_SEGMENT[this.lastRestPoint];
    if (idx === null) return;
    const segment = this.segments[idx];
    if (!segment) return;

    segment.action.reset();
    segment.action.timeScale = 1;
    segment.action.time = 0;
    if (segment.name === 'AB' && this.abStartFrame > AB_CAM_FRAME_START) {
      // Départ avancé (dev) : saute directement à la frame demandée — caméra + Sentinelle suivent (tout dérive de action.time).
      const u = (this.abStartFrame - AB_CAM_FRAME_START) / (AB_CAM_FRAME_END - AB_CAM_FRAME_START);
      segment.action.time = u * segment.duration;
    }
    segment.action.paused = false;
    segment.action.play();

    this.activeAction = segment.action;
    this.activeDirection = 'forward';
    this.tripFrom = this.lastRestPoint;
    this.tripTo = segment.endRestPoint;
    this.restWeightTarget = 0; // fondu de sortie du recul pendant que le clip démarre
    this.state = 'playing';
  }

  triggerBackward(): void {
    if (this.state !== 'dwell') return;
    const idx = BACKWARD_SEGMENT[this.lastRestPoint];
    if (idx === null) return;
    const segment = this.segments[idx];
    if (!segment) return;

    // A segment is played REVERSED when the current rest point is its END (e.g. B→D
    // via the DB segment whose natural direction is D→B). Otherwise it's a dedicated
    // backward segment played forward (C→B via CB, D→C via DC).
    const reversed = segment.endRestPoint === this.lastRestPoint;

    segment.action.reset();
    if (reversed) {
      segment.action.timeScale = -1;
      segment.action.time = segment.duration;
      this.activeDirection = 'backward';
      this.tripTo = segment.startRestPoint;
    } else {
      segment.action.timeScale = 1;
      segment.action.time = 0;
      this.activeDirection = 'forward';
      this.tripTo = segment.endRestPoint;
    }
    this.tripFrom = this.lastRestPoint;
    segment.action.paused = false;
    segment.action.play();

    this.activeAction = segment.action;
    this.restWeightTarget = 0; // fondu de sortie du recul pendant que le clip démarre
    this.state = 'playing';
  }

  setFreeMode(active: boolean): void {
    if (active) {
      if (this.state === 'playing' && this.activeAction) {
        this.activeAction.paused = true;
      }
      if (this.state === 'reading') {
        this.readingCardIdx = null;
        this.dispatchReading();
      }
      this.state = 'free';
      this.dispatchUpdate();
    } else {
      this.state = 'dwell';
      this.snapToRestPoint(this.lastRestPoint);
      this.activeAction = null;
      this.gauge.reset();
      this.dispatchUpdate();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Snap main camera to a rest point by evaluating the relevant forward segment at the right time */
  private snapToRestPoint(point: RestPoint): void {
    if (this.segments.length === 0) return;

    // For each rest point we pick the FORWARD segment that anchors that point:
    //   A: start of AB    (segment 0, time 0)
    //   B: start of BC    (segment 1, time 0)
    //   C: start of CD    (segment 2, time 0)
    //   D: end of CD      (segment 2, time = duration)
    let segment: Segment | undefined;
    let time = 0;

    if (point === 'D') {
      segment = this.segments[FORWARD_CD];
      time = segment ? segment.duration : 0;
    } else {
      const idx = FORWARD_SEGMENT[point];
      if (idx !== null) {
        segment = this.segments[idx];
        time = 0;
      }
    }

    if (!segment) return;

    // Evaluate the action at the given time
    const action = segment.action;
    action.reset();
    action.paused = true;
    action.time = time;
    action.play();
    segment.mixer.update(0);

    // Copy transform
    const source = segment.cameraNode;
    source.updateMatrixWorld(true);
    this.mainCamera.position.setFromMatrixPosition(source.matrixWorld);
    this.tmpMat.extractRotation(source.matrixWorld);
    this.mainCamera.quaternion.setFromRotationMatrix(this.tmpMat);
    if (Math.abs(source.fov - this.mainCamera.fov) > 0.01) {
      this.mainCamera.fov = source.fov;
      this.mainCamera.updateProjectionMatrix();
    }

    // Stop the action so it doesn't keep ticking
    action.stop();

    // Capture la pose de repos comme base de la vue élargie (recul/FOV).
    // Snap/jump → recul appliqué immédiatement (pas de clip d'arrivée à raccorder).
    this.captureRestBase(true);
  }

  private findSegmentByAction(action: THREE.AnimationAction): Segment | undefined {
    return this.segments.find(s => s.action === action);
  }

  canGoForward(): boolean {
    // Every rest point now has a forward segment (D loops back to B via DB)
    return !this.navigationLocked && this.state === 'dwell' && this.segments.length > 0;
  }

  canGoBackward(): boolean {
    return !this.navigationLocked && this.state === 'dwell' && this.lastRestPoint !== 'A' && this.segments.length > 0;
  }

  // ── UI event ───────────────────────────────────────────────────────────

  private dispatchUpdate(): void {
    window.dispatchEvent(new CustomEvent('overmind:scroll-gauge-update', {
      detail: {
        value: this.gauge.getValue(),
        state: this.state,
        currentPoint: this.lastRestPoint,
        canGoForward: this.canGoForward(),
        canGoBackward: this.canGoBackward(),
      },
    }));
  }

  private dispatchReading(): void {
    const idx = this.readingCardIdx;
    const entry = idx !== null ? this.cardEntries[idx] : null;
    const viewportFrac = entry ? (entry.material.uniforms['uViewportFrac']?.value as number) : 0;
    const offset = idx !== null ? this.textOffsets[idx] : 0;
    window.dispatchEvent(new CustomEvent('overmind:reading-mode', {
      detail: {
        active: this.state === 'reading',
        cardIdx: idx,
        offset,
        viewportFrac,
      },
    }));
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  dispose(): void {
    this.gauge.dispose();
    for (const seg of this.segments) {
      seg.mixer.stopAllAction();
      seg.mixer.uncacheRoot(this.model);
    }
    this.segments = [];
    this.activeAction = null;
    this.progressListener = null;
  }
}
