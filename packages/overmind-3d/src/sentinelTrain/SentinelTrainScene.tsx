import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadSentinelPath } from './pathLoader.ts';
import { setupCreatureWiggles, updateWiggles, disposeWiggles, setupEyeCollision, applyEyeCollision, type WiggleBoneInstance } from './wiggleBones.ts';
import { setupSHArmShaders, LEADER_SAMPLES, type LeaderFollowUniforms } from './shArmShader.ts';

/** Armatures animated by wiggle spring-bone (per Claude/20_Sentinel_Train/README.md). */
const WIGGLE_ARMATURES = [
  'Armature.000',   // leader (small arm, 18 bones)
  'ArmatureBIG1',
  'ArmatureBIG2',
  'ArmatureBIG3',
  'ArmatureBIG4',
];

/** Wiggle velocity: lower = more drag/lag, higher = stiffer. Tune as needed. */
const WIGGLE_VELOCITY = 0.12;

// ── Phase 6 : réactivité des bras SH au leader ────────────────────────────────
// La vélocité du bout du bras leader (espace LOCAL créature = uniquement le swing
// du wiggle, pas le déplacement sur la courbe) booste l'amplitude des vagues SH.
/** Gain : unités locales/s → boost. */
const BOOST_GAIN = 0.6;
/** Boost max (forces ×(1+max)). */
const BOOST_MAX = 2.5;
/** Lissage exponentiel de la vélocité (0-1, plus bas = plus lisse). */
const BOOST_SMOOTH = 0.08;

// ── Banking : inclinaison dans les virages (comme un drone/avion) ────────────
/** Gain : rad de roll par rad de virage échantillonné sur la courbe. */
const BANK_GAIN = 1.4;
/** Inclinaison max (30°). */
const BANK_MAX = Math.PI / 6;
/** Lissage de l'inclinaison (0-1, plus bas = transitions plus douces). */
const BANK_SMOOTH = 0.06;
/** Écart de t pour échantillonner la tangente "future" (mesure du virage). */
const BANK_LOOKAHEAD = 0.03;

// ── Barrel roll : 360° occasionnel sur l'axe de vol, dans les lignes droites ──
/** Durée du roll complet (s). */
const ROLL_DURATION = 1.6;
/** Délai minimum entre deux rolls (s). */
const ROLL_COOLDOWN = 8;
/** Temps de ligne droite requis avant éligibilité (s). */
const ROLL_STRAIGHT_TIME = 0.5;
/** Sous ce taux de virage (rad), le chemin est considéré "droit".
 *  NB: la courbe AB est sinueuse — seuil assoupli, sinon aucun segment n'est "droit". */
const ROLL_TURN_THRESHOLD = 0.06;
/** Probabilité de déclenchement par seconde éligible. */
const ROLL_CHANCE_PER_SEC = 0.8;
/** Nombre de tours par roll (1 = 360°, 0.5 = 180°). */
const ROLL_TURNS = 1.0;

// ── Clignement des paupières (Bone_Lid_Upper/Lower du Eye_Rig) ────────────────
/** Durée de fermeture (s) — rapide. */
const BLINK_CLOSE_TIME = 0.09;
/** Durée d'ouverture (s) — un peu plus lente. */
const BLINK_OPEN_TIME = 0.18;
/** Angle de fermeture paupière supérieure (rad, signe inversé après calibrage visuel). */
const BLINK_UPPER_ANGLE = -0.9;
/** Angle de fermeture paupière inférieure (rad). */
const BLINK_LOWER_ANGLE = 0.9;
/** Intervalle entre clignements (s) : min + random × (max-min). */
const BLINK_GAP_MIN = 2.0;
const BLINK_GAP_MAX = 6.0;
/** Probabilité de double-clin. */
const BLINK_DOUBLE_CHANCE = 0.25;

// ── Regard de l'iris (Bone_Iris) : scan ambiant + regarde dans le virage ─────
/** Amplitude du scan ambiant (rad). */
const IRIS_SCAN_AMP = 0.10;
/** Gain regard-dans-le-virage : rad d'iris par rad de virage (négatif : calibré visuellement). */
const IRIS_TURN_GAIN = -1.5;
/** Déviation max de l'iris (rad ≈ 17°). */
const IRIS_MAX = 0.3;
/** Lissage du regard directionnel. */
const IRIS_SMOOTH = 0.07;

// ── Collision bras ↔ œil ──────────────────────────────────────────────────────
/** Marge appliquée au rayon englobant du globe oculaire (sphère de collision). */
const EYE_COLLISION_MARGIN = 1.1;

// ── Pinces : respiration d'ouverture + ouverture réflexe pendant les rolls ───
/** Amplitude de la respiration des pinces (rad). */
const CLAW_BREATH = 0.12;
/** Ouverture réflexe pendant un barrel roll (rad). */
const CLAW_ROLL_OPEN = 0.45;
/** Vitesse de la respiration (rad/s de phase). */
const CLAW_BREATH_SPEED = 0.8;
/** Lissage de l'ouverture réflexe. */
const CLAW_SMOOTH = 0.1;

/**
 * SentinelTrain — banc d'essai créature (œil + bras animés).
 *
 * Plein écran, isolé du portfolio normal. Activé par `#sentinel-train`.
 *
 * Phase actuelle : **3** — chargement GLB, curve, suivi du chemin par l'œil.
 *
 * Voir Claude/20_Sentinel_Train/README.md pour le plan complet.
 */
export function SentinelTrainScene({ basePath = '/' }: { basePath?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState('Initializing…');
  const [debugInfo, setDebugInfo] = useState<{ tParam: number; eyePos: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Three.js basics ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0e);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(15, 8, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // ── Lights ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    // ── Reference grid + axes ───────────────────────────────────────────────
    const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
    scene.add(grid);
    const axes = new THREE.AxesHelper(3);
    scene.add(axes);

    // ── Load model + curve ──────────────────────────────────────────────────
    let mixer: THREE.AnimationMixer | null = null;
    let creature: THREE.Object3D | null = null;
    let curve: THREE.CurvePath<THREE.Vector3> | null = null;
    let curveLine: THREE.Line | null = null;
    let wiggles: WiggleBoneInstance[] = [];
    let shArmUpdateTime: ((elapsed: number) => void) | null = null;
    let shArmSetBoost: ((boost: number) => void) | null = null;
    let leaderTip: THREE.Object3D | null = null;
    // Leader-follow: main bone chain of Armature000 (captured BEFORE wiggle setup,
    // because WiggleBone inserts clones into the hierarchy afterwards).
    let leaderChain: THREE.Object3D[] = [];
    let leaderRestPos: THREE.Vector3[] = [];   // rest positions, creature space
    let leaderTParams: number[] = [];          // cumulative 0→1 param along chain
    let leaderDeltas: THREE.Vector3[] = [];    // per-bone deviation buffer (reused)
    let leaderUniformsRef: LeaderFollowUniforms | null = null;
    // Eye bones (Eye_Rig is NOT wiggled → safe to drive directly)
    let lidUpper: THREE.Object3D | null = null;
    let lidLower: THREE.Object3D | null = null;
    let lidUpperRestX = 0;
    let lidLowerRestX = 0;
    let irisBone: THREE.Object3D | null = null;
    let irisRestX = 0;
    let irisRestZ = 0;
    // Claw bones of the 5 boned arms (captured BEFORE wiggle setup). These bones
    // ARE wiggled, so we apply our opening as an ADDITIVE rotation after the
    // wiggle update each frame (the wiggle rewrites rotations next frame anyway).
    let clawBones: Array<{ bone: THREE.Object3D; armPhase: number }> = [];
    // Eye collision: spring-memory clamping against a sphere around the eyeball
    let collisionWiggles: WiggleBoneInstance[] = [];
    let eyeCollisionRadius = 0;
    let disposed = false;

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${basePath}draco/`);
    loader.setDRACOLoader(draco);

    Promise.all([
      new Promise<THREE.Object3D>((resolve, reject) => {
        loader.load(
          `${basePath}models/Sentinel_TRAIN.glb`,
          (gltf) => resolve(gltf.scene),
          undefined,
          reject,
        );
      }),
      loadSentinelPath(basePath),
    ]).then(([loadedScene, pathResult]) => {
      if (disposed) return;
      creature = loadedScene;
      scene.add(creature);
      curve = pathResult.curveAB;

      // Build a visible polyline for the curve (debug)
      const samples = curve.getPoints(256);
      const geo = new THREE.BufferGeometry().setFromPoints(samples);
      const mat = new THREE.LineBasicMaterial({ color: 0xff9933 });
      curveLine = new THREE.Line(geo, mat);
      scene.add(curveLine);

      // Log some structural info
      const armatures: string[] = [];
      const shArms: string[] = [];
      creature.traverse((o) => {
        if (o.name.startsWith('Armature') || o.name === 'Eye_Rig') armatures.push(o.name);
        if (o.name.startsWith('SH')) shArms.push(o.name);
      });
      console.log('[SentinelTrain] armatures in scene:', armatures);
      console.log('[SentinelTrain] SH meshes:', shArms.length, 'items');

      // ── Leader-follow: capture the leader's main bone chain BEFORE wiggle ──
      // (WiggleBone will insert proxy clones into the hierarchy — capturing now
      // gives us the clean chain of real bones.)
      {
        const leaderArm = creature.getObjectByName('Armature000') ?? creature.getObjectByName('Armature.000');
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
          // (cast: TS can't track the assignment inside the traverse closure)
          const tipObj = tip as THREE.Object3D | null;
          if (tipObj) {
            leaderTip = tipObj;
            // Walk back tip → armature root to get the ordered chain (base first)
            const chain: THREE.Object3D[] = [];
            let cur: THREE.Object3D | null = tipObj;
            while (cur && cur !== leaderArm) {
              if ((cur as THREE.Bone).isBone) chain.unshift(cur);
              cur = cur.parent;
            }
            leaderChain = chain;
            // Rest positions in creature space + cumulative arc-length params
            const v = new THREE.Vector3();
            let total = 0;
            leaderRestPos = [];
            leaderTParams = [];
            for (let i = 0; i < chain.length; i++) {
              chain[i].getWorldPosition(v);
              creature.worldToLocal(v);
              leaderRestPos.push(v.clone());
              if (i === 0) {
                leaderTParams.push(0);
              } else {
                total += leaderRestPos[i].distanceTo(leaderRestPos[i - 1]);
                leaderTParams.push(total);
              }
            }
            if (total > 0) {
              for (let i = 0; i < leaderTParams.length; i++) leaderTParams[i] /= total;
            }
            leaderDeltas = leaderRestPos.map(() => new THREE.Vector3());
            console.log(`[SentinelTrain] leader chain: ${chain.length} bones, length=${total.toFixed(2)} (tip=${tipObj.name})`);
          }
        } else {
          console.warn('[SentinelTrain] leader armature not found — leader-follow disabled');
        }
      }

      // ── Eye bones (blink + iris gaze). Eye_Rig is not wiggled → direct drive.
      lidUpper = creature.getObjectByName('Bone_Lid_Upper') ?? null;
      lidLower = creature.getObjectByName('Bone_Lid_Lower') ?? null;
      irisBone = creature.getObjectByName('Bone_Iris') ?? null;
      if (lidUpper) lidUpperRestX = lidUpper.rotation.x;
      if (lidLower) lidLowerRestX = lidLower.rotation.x;
      if (irisBone) { irisRestX = irisBone.rotation.x; irisRestZ = irisBone.rotation.z; }
      console.log(`[SentinelTrain] eye bones: lidUpper=${!!lidUpper} lidLower=${!!lidLower} iris=${!!irisBone}`);

      // ── Claw bones: in each wiggled armature, the "palm" is the bone with ≥2
      // bone children; all its descendants are finger bones. Captured BEFORE the
      // wiggle setup (clones get inserted after).
      {
        clawBones = [];
        let armIdx = 0;
        for (const armName of WIGGLE_ARMATURES) {
          const arm =
            creature.getObjectByName(armName) ??
            creature.getObjectByName(armName.replace(/\./g, '')) ??
            creature.getObjectByName(armName.replace(/\./g, '_'));
          if (!arm) continue;
          const armPhase = armIdx * 1.7; // desync breathing between arms
          arm.traverse((o) => {
            if (!(o as THREE.Bone).isBone) return;
            const boneChildren = o.children.filter((c) => (c as THREE.Bone).isBone);
            if (boneChildren.length < 2) return; // not a palm
            // All bone descendants of the palm = finger/claw bones
            o.traverse((d) => {
              if (d === o) return;
              if ((d as THREE.Bone).isBone) clawBones.push({ bone: d, armPhase });
            });
          });
          armIdx += 1;
        }
        console.log(`[SentinelTrain] claw bones captured: ${clawBones.length}`);
      }

      // ── Wiggle spring-bones (Phase 4) ─────────────────────────────────────
      const wiggleResult = setupCreatureWiggles(creature, WIGGLE_ARMATURES, WIGGLE_VELOCITY);
      wiggles = wiggleResult.wiggles;
      console.log('[SentinelTrain] wiggle armatures found:', wiggleResult.foundArmatures);
      if (wiggleResult.missingArmatures.length > 0) {
        console.warn('[SentinelTrain] wiggle armatures MISSING:', wiggleResult.missingArmatures);
      }
      // Per-armature detail: totalBones vs wiggleBones — if an armature shows
      // wiggleBones=0 (or very low), its bones are not parent-chained like the others
      // and the spring setup skips them.
      for (const pa of wiggleResult.perArmature) {
        console.log(`[SentinelTrain]   ${pa.name}: ${pa.wiggleBones} wiggle / ${pa.totalBones} bones`);
      }
      console.log(`[SentinelTrain] wiggle bones total: ${wiggles.length} (velocity=${WIGGLE_VELOCITY})`);

      // ── Eye collision sphere: radius from the eyeball mesh bounding sphere.
      // Only bones whose REST position lies outside the sphere are constrained
      // (arm bases sit right behind the eye and must stay free).
      {
        const eyeball = creature.getObjectByName('Scleral_Conjunctiva');
        if (eyeball) {
          const box = new THREE.Box3().setFromObject(eyeball);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          eyeCollisionRadius = sphere.radius * EYE_COLLISION_MARGIN;
          const eyeCenter = new THREE.Vector3();
          creature.getWorldPosition(eyeCenter);
          collisionWiggles = setupEyeCollision(wiggles, eyeCenter, eyeCollisionRadius);
          console.log(`[SentinelTrain] eye collision: radius=${eyeCollisionRadius.toFixed(2)}, constrained ${collisionWiggles.length}/${wiggles.length} bones`);
        } else {
          console.warn('[SentinelTrain] Scleral_Conjunctiva not found — eye collision disabled');
        }
      }

      // ── Vertex shader GLSL (onBeforeCompile) on SH* arms ──────────────────
      // Sinusoïde réduite (micro-vie) — le mouvement principal vient du leader-follow.
      const shResult = setupSHArmShaders(creature, { speed1: 1.2, force1: 0.08, speed2: 3.5, force2: 0.03 });
      shArmUpdateTime = shResult.updateTime;
      shArmSetBoost = shResult.setBoost;
      leaderUniformsRef = shResult.leaderUniforms;
      console.log('[SentinelTrain] SH arms with wave shader:', shResult.arms.map(a => `${a.name}(${a.meshCount})`).join(', '));
      console.log(`[SentinelTrain] total SH meshes shaded: ${shResult.totalMeshes}`);

      setStatus(`Loaded · ${armatures.length} armatures · ${shArms.length} SH meshes · ${wiggles.length} wiggle bones · ${shResult.arms.length} SH arms shaded · leader chain ${leaderChain.length}`);
    }).catch((err) => {
      console.error('[SentinelTrain] load failed', err);
      setStatus(`Load error: ${err?.message ?? String(err)}`);
    });

    // ── Animation loop ──────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    const prevTarget = new THREE.Vector3();
    const targetDelta = new THREE.Vector3();
    // Phase 6 — leader tip velocity tracking (creature-local space)
    const tipLocal = new THREE.Vector3();
    const prevTipLocal = new THREE.Vector3();
    // Eye collision temps
    const eyeCenterTmp = new THREE.Vector3();
    const collTmp = new THREE.Vector3();
    let tipInitialized = false;
    let smoothedBoost = 0;
    // Banking + barrel roll state
    const tanA = new THREE.Vector3();
    const tanB = new THREE.Vector3();
    let smoothedBank = 0;
    let straightTime = 0;
    let rollActive = false;
    let rollPhase = 0;
    let lastRollEnd = -ROLL_COOLDOWN; // allow an early first roll
    let lastTurn = 0; // signed turn rate, shared with the iris gaze
    // Blink state (drives Bone_Lid_Upper/Lower → meshes Eyelid_Sup.001/Inf.001)
    let blinkPhase = -1;            // -1 = idle, otherwise 0..(close+open)
    let nextBlinkAt = 2.0;          // s
    let pendingDoubleBlink = false;
    // Iris gaze state
    let smoothedIrisYaw = 0;
    // Claw opening state
    let smoothedClawOpen = 0;
    // Path traversal: loop AB forever, slowly
    const LOOP_DURATION_SEC = 24; // tweak: how long for one full AB pass
    const LOOK_AHEAD = 0.05;

    function tick() {
      if (disposed) return;
      requestAnimationFrame(tick);
      const dt = clock.getDelta();
      if (mixer) mixer.update(dt);

      if (creature && curve) {
        const t = ((clock.elapsedTime / LOOP_DURATION_SEC) % 1 + 1) % 1;
        curve.getPointAt(t, tmp);
        creature.position.copy(tmp);
        // Look-ahead orientation: face the point slightly ahead on the curve.
        const tAhead = Math.min(1, t + LOOK_AHEAD);
        curve.getPointAt(tAhead, ahead);
        creature.lookAt(ahead);
        // The eye rest pose faces -Z. lookAt() already aligns -Z to the target,
        // so no extra rotation is needed.

        // ── Banking: measure the horizontal turn rate of the path and lean into it
        curve.getTangentAt(t, tanA);
        curve.getTangentAt(Math.min(1, t + BANK_LOOKAHEAD), tanB);
        tanA.y = 0; tanB.y = 0;
        if (tanA.lengthSq() > 1e-6 && tanB.lengthSq() > 1e-6) {
          tanA.normalize(); tanB.normalize();
          // Signed sin of the horizontal angle between current and future tangents
          const crossY = tanA.x * tanB.z - tanA.z * tanB.x;
          const turn = Math.asin(Math.max(-1, Math.min(1, crossY)));
          lastTurn = turn; // shared with the iris "look into the turn"
          const bankTarget = Math.max(-BANK_MAX, Math.min(BANK_MAX, turn * BANK_GAIN));
          smoothedBank += (bankTarget - smoothedBank) * BANK_SMOOTH;
          // Straight-line tracking for barrel roll eligibility
          if (Math.abs(turn) < ROLL_TURN_THRESHOLD) straightTime += dt;
          else straightTime = 0;
        }

        // ── Barrel roll: occasionally do a full roll on straights
        if (
          !rollActive &&
          straightTime > ROLL_STRAIGHT_TIME &&
          clock.elapsedTime - lastRollEnd > ROLL_COOLDOWN &&
          Math.random() < ROLL_CHANCE_PER_SEC * dt
        ) {
          rollActive = true;
          rollPhase = 0;
          console.log(`[SentinelTrain] barrel roll! (t=${t.toFixed(3)})`);
        }
        let rollAngle = 0;
        if (rollActive) {
          rollPhase += dt / ROLL_DURATION;
          if (rollPhase >= 1) {
            rollActive = false;
            rollPhase = 1;
            lastRollEnd = clock.elapsedTime;
          }
          // easeInOutCubic for a soft start/end of the roll
          const p = rollPhase;
          const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          rollAngle = eased * Math.PI * 2 * ROLL_TURNS;
        }

        // Apply bank + roll around the local flight axis (Z = the look direction axis)
        creature.rotateZ(smoothedBank + rollAngle);

        // Update debug HUD (throttled to ~10fps to avoid React thrash)
        if ((clock.elapsedTime * 10 | 0) % 1 === 0) {
          setDebugInfo({ tParam: t, eyePos: tmp.clone() });
        }
      }

      // Wiggle bones must update AFTER the creature has been moved this frame,
      // so they sample the new rest-position and lag naturally behind it.
      if (wiggles.length > 0) updateWiggles(wiggles);

      // Eye collision: clamp the spring memory of arm bones outside the eyeball
      // sphere → arms slide around the eye instead of passing through it
      // (matters during idle/dwell when the eye drifts backward into the arms).
      if (collisionWiggles.length > 0 && creature && eyeCollisionRadius > 0) {
        creature.getWorldPosition(eyeCenterTmp);
        applyEyeCollision(collisionWiggles, eyeCenterTmp, eyeCollisionRadius, collTmp);
      }

      // ── Claws: breathing open/close + reflex opening during barrel rolls.
      // Claw bones are wiggled (wiggle rewrites their rotation every update), so we
      // apply our opening as an ADDITIVE rotation AFTER the wiggle pass each frame.
      if (clawBones.length > 0) {
        const clawTarget = rollActive ? CLAW_ROLL_OPEN : 0;
        smoothedClawOpen += (clawTarget - smoothedClawOpen) * CLAW_SMOOTH;
        for (const c of clawBones) {
          const breath = (Math.sin(clock.elapsedTime * CLAW_BREATH_SPEED + c.armPhase) * 0.5 + 0.5) * CLAW_BREATH;
          c.bone.rotateX(breath + smoothedClawOpen);
        }
      }

      // Drive the SH arm wave shader (GLSL uniform uTime)
      if (shArmUpdateTime) shArmUpdateTime(clock.elapsedTime);

      // Leader-follow: sample the leader chain's current deviation from rest
      // (creature space) and resample it onto LEADER_SAMPLES regular points for
      // the SH arm shader. Must run AFTER updateWiggles (bones just moved).
      if (leaderChain.length > 1 && leaderUniformsRef && creature) {
        // Per-bone deviation from rest pose, in creature space
        for (let i = 0; i < leaderChain.length; i++) {
          leaderChain[i].getWorldPosition(leaderDeltas[i]);
          creature.worldToLocal(leaderDeltas[i]);
          leaderDeltas[i].sub(leaderRestPos[i]);
        }
        // Resample onto regular t = s/(S-1) using cumulative arc-length params
        const out = leaderUniformsRef.uLeaderDelta.value;
        let j = 0;
        for (let s = 0; s < LEADER_SAMPLES; s++) {
          const t = s / (LEADER_SAMPLES - 1);
          while (j < leaderTParams.length - 2 && leaderTParams[j + 1] < t) j++;
          const t0 = leaderTParams[j];
          const t1 = leaderTParams[j + 1];
          const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
          out[s].copy(leaderDeltas[j]).lerp(leaderDeltas[j + 1], Math.max(0, Math.min(1, f)));
        }
        leaderUniformsRef.uLeaderCount.value = LEADER_SAMPLES;
      }

      // ── Blink: Bone_Lid_Upper/Lower → meshes Eyelid_Sup.001 / Eyelid_Inf.001
      if (lidUpper && lidLower) {
        if (blinkPhase < 0 && clock.elapsedTime >= nextBlinkAt) {
          blinkPhase = 0;
          pendingDoubleBlink = Math.random() < BLINK_DOUBLE_CHANCE;
        }
        let blinkAmount = 0;
        if (blinkPhase >= 0) {
          blinkPhase += dt;
          if (blinkPhase < BLINK_CLOSE_TIME) {
            blinkAmount = blinkPhase / BLINK_CLOSE_TIME;            // closing
          } else if (blinkPhase < BLINK_CLOSE_TIME + BLINK_OPEN_TIME) {
            blinkAmount = 1 - (blinkPhase - BLINK_CLOSE_TIME) / BLINK_OPEN_TIME; // opening
          } else {
            blinkPhase = -1;
            if (pendingDoubleBlink) {
              pendingDoubleBlink = false;
              nextBlinkAt = clock.elapsedTime + 0.15; // quick second blink
            } else {
              nextBlinkAt = clock.elapsedTime + BLINK_GAP_MIN + Math.random() * (BLINK_GAP_MAX - BLINK_GAP_MIN);
            }
          }
        }
        lidUpper.rotation.x = lidUpperRestX + blinkAmount * BLINK_UPPER_ANGLE;
        lidLower.rotation.x = lidLowerRestX + blinkAmount * BLINK_LOWER_ANGLE;
      }

      // ── Iris gaze: ambient scan + look into the turn (anticipation)
      if (irisBone) {
        // Non-commensurable frequencies → organic, non-repeating scan
        const scanV = Math.sin(clock.elapsedTime * 0.53 + 1.7) * IRIS_SCAN_AMP * 0.6;
        const scanH = Math.sin(clock.elapsedTime * 0.31) * IRIS_SCAN_AMP;
        const yawTarget = Math.max(-IRIS_MAX, Math.min(IRIS_MAX, lastTurn * IRIS_TURN_GAIN));
        smoothedIrisYaw += (yawTarget - smoothedIrisYaw) * IRIS_SMOOTH;
        irisBone.rotation.x = irisRestX + scanV;
        irisBone.rotation.z = irisRestZ + scanH + smoothedIrisYaw;
      }

      // Phase 6 — SH reactivity: measure the leader tip velocity in CREATURE-LOCAL
      // space (so we only capture the wiggle swing, not the path travel), smooth it,
      // and boost the SH wave amplitude accordingly.
      if (leaderTip && creature && shArmSetBoost && dt > 0) {
        leaderTip.getWorldPosition(tipLocal);
        creature.worldToLocal(tipLocal);
        if (!tipInitialized) {
          prevTipLocal.copy(tipLocal);
          tipInitialized = true;
        }
        const tipSpeed = prevTipLocal.distanceTo(tipLocal) / dt; // local units/s
        prevTipLocal.copy(tipLocal);
        const rawBoost = Math.min(tipSpeed * BOOST_GAIN, BOOST_MAX);
        smoothedBoost += (rawBoost - smoothedBoost) * BOOST_SMOOTH;
        shArmSetBoost(smoothedBoost);
      }

      // Camera follow at constant distance: the orbit target glides toward the
      // creature, and the camera is translated by the SAME delta — so the
      // camera↔creature offset (distance + angle) stays constant while following.
      // Orbit/zoom still work and redefine the maintained offset.
      if (creature) {
        prevTarget.copy(controls.target);
        controls.target.lerp(creature.position, 0.08);
        targetDelta.copy(controls.target).sub(prevTarget);
        camera.position.add(targetDelta);
      }

      controls.update();
      renderer.render(scene, camera);
    }
    tick();

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      if (wiggles.length > 0) disposeWiggles(wiggles);
      controls.dispose();
      draco.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mt of mats) (mt as THREE.Material)?.dispose?.();
        }
      });
    };
  }, [basePath]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#000' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', top: 12, left: 12,
        color: '#cbd5e1', fontFamily: 'monospace', fontSize: 12,
        background: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: 4,
        pointerEvents: 'none', userSelect: 'none', lineHeight: 1.5,
      }}>
        <div><strong>SentinelTrain — Phase 3</strong></div>
        <div>{status}</div>
        {debugInfo && (
          <div>
            t = {debugInfo.tParam.toFixed(3)} · eye = (
            {debugInfo.eyePos.x.toFixed(2)}, {debugInfo.eyePos.y.toFixed(2)}, {debugInfo.eyePos.z.toFixed(2)})
          </div>
        )}
        <div style={{ opacity: 0.6, marginTop: 4 }}>Orbit: drag / wheel / right-drag</div>
      </div>
    </div>
  );
}
