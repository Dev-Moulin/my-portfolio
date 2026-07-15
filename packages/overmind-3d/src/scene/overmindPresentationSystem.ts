import * as THREE from 'three';

/**
 * OvermindPresentationSystem — l'Overmind INTÉGRÉ (node OVM_ROOT du GLB vaisseau V2.8.1+) joue
 * ses bras en boucle (repos), puis PRÉSENTE périodiquement un objet.
 *
 * Séquence d'une présentation (recette reprise du projet Overmind d'origine) :
 *  1. crossfade des 2 bras `Bras_R1/R2_Mouv` → poses `R1&R2_Pose` / `R2&R1_Pose` (les autres bras
 *     continuent de tourner en boucle) ;
 *  2. « portail » TOUJOURS présent : montée des 5 `AnneauxBloomArea_1→5` (+ `Action_Ring`) ;
 *  3. UN objet central : anneaux `Ring_Ext/Int_SG1`, OU `Icon_BTC`, OU `Icon_ETH` ;
 *  4. retour AUTO quand la pose (LoopOnce) se termine → crossfade poses → bras + objets recachés.
 *
 * Toutes les actions vivent sur un unique AnimationMixer(OVM_ROOT). Les noms de bones dupliqués
 * du GLB brut sont dédupliqués par GLTFLoader → résolution correcte dans le sous-arbre OVM_ROOT.
 */

// Clips PERMANENTS du rig Overmind (bras + anneaux de l'œil), joués en boucle au repos.
const PERMANENT_ANIMS = [
  'Bras_L1_Mouv', 'Bras_L2_Mouv', 'Bras_R1_Mouv', 'Bras_R2_Mouv',
  'Little_1_Mouv', 'Little_2_Mouv', 'Little_3_Mouv', 'Little_4_Mouv',
  'Little_5_Mouv', 'Little_6_Mouv', 'Little_7_Mouv', 'Little_8_Mouv',
  'Arm_Little_9Action', 'Little_10_Mouv', 'Little_11_Mouv',
  'Little_12_Mouv', 'Little_13_Mouv',
  'Anneaux_Eye_Ext_Action', 'Anneaux_Eye_Int_Action',
];

// ── Réglages (TEST puis final) ───────────────────────────────────────────────
const TEST_MODE = true;         // TEST : intervalle court (30 s) + cycle déterministe des objets.
const TEST_INTERVAL_S = 30;     // repos entre présentations en mode test.
const FINAL_MIN_S = 90;         // final : repos aléatoire 1 min 30…
const FINAL_MAX_S = 150;        // …2 min 30.
const FADE_DURATION = 1.5;      // crossfade bras ↔ pose (s).
const POSE_TIMESCALE = 0.8;     // vitesse native des poses (fidèle au moteur d'origine).
const RING_TIMESCALE = 0.8;     // vitesse native des anneaux / objets.
const ARM_TIMESCALE = 0.6;      // vitesse des bras permanents (comme au chargement).
const BLOOM_EMISSIVE = 1.5;     // émissif des anneaux (5 AnneauxBloomArea + Ring_Ext/Int_SG1). Réglable (event tune, `bloom`).
const BLOOM_EMISSIVE_ICONS = 1.2;  // émissif plus faible pour les logos Bitcoin/Ethereum. Réglable (event tune, `bloomIcons`).

// ── Zone de révélation ───────────────────────────────────────────────────────
// Matérialisée par le node `Cylinder_Trigger` (mesh cylindre enfant d'OVM_ROOT, posé dans Blender).
// On lit sa bounding box WORLD → centre + rayon + demi-hauteur. Logique INVERSÉE : un mesh de
// présentation est CACHÉ tant qu'il est DANS le cylindre, VISIBLE quand il en SORT → il se dévoile
// en montant (effet portail). Plus AUCUNE coordonnée en dur : Paul déplace le groupe dans Blender,
// le web suit. Tant que la position n'est pas figée, on affiche le cylindre en wireframe.
const ZONE_MESH_NAME = 'Cylinder_Trigger';
const SHOW_ZONE_HELPER = false;     // true = cylindre visible (wireframe) pour caler ; false = invisible.

// ── Ondulation + suivi caméra (pilotage d'OVM_ROOT ; le mixer n'anime QUE les bones) ─────────
// Valeurs de départ « pas énormes » (repère parent = vaisseau, scale 1/4). Réglables à l'œil via
// l'event `overmind:tune` (detail : { driftX, driftY, driftZ, driftSpeed, yawOffset, lookSmooth }).
const DRIFT_AMP = { x: 0.7, y: 0.5, z: 0.7 };  // amplitude du flottement autour de la pose Blender.
const DRIFT_SPEED = 0.5;                         // vitesse du flottement (lent).
const LOOK_AT_CAMERA = true;                     // l'Overmind entier s'oriente vers la caméra.
const LOOK_SMOOTH = 0.06;                        // lissage de l'orientation (0 = figé, 1 = instantané).
const LOOK_YAW_OFFSET = 0;                       // offset d'orientation si l'Overmind n'est pas « de face » (rad).
const UP = new THREE.Vector3(0, 1, 0);

// ── Clips & meshes ───────────────────────────────────────────────────────────
const POSE_CLIPS = ['R1&R2_Pose', 'R2&R1_Pose'] as const;
// Quelle pose remplace quel bras permanent (et inversement au retour).
const POSE_ARM: Record<string, string> = {
  'R1&R2_Pose': 'Bras_R1_Mouv',
  'R2&R1_Pose': 'Bras_R2_Mouv',
};

// « Portail » : les 5 anneaux Bloom qui montent — TOUJOURS joués.
const PORTAL_MESHES = ['AnneauxBloomArea_1', 'AnneauxBloomArea_2', 'AnneauxBloomArea_3', 'AnneauxBloomArea_4', 'AnneauxBloomArea_5'];
const PORTAL_CLIPS = [
  'Ring_BloomArea_1Action_Ring', 'Ring_BloomArea_2Action_Ring', 'Ring_BloomArea_3Action_Ring',
  'Ring_BloomArea_4Action_Ring', 'Ring_BloomArea_5Action_Ring', 'Action_Ring',
];

// Les 3 objets présentables (un au hasard/en cycle). meshes = à montrer, clips = à jouer.
interface PresentObject { label: string; meshes: string[]; clips: string[]; }
const OBJECTS: PresentObject[] = [
  { label: 'anneaux SG1', meshes: ['Ring_Ext_SG1', 'Ring_Int_SG1'], clips: ['Ring_Ext_SG1Action_Ring', 'Ring_Int_SG1Action'] },
  { label: 'Bitcoin', meshes: ['Icon_BTC'], clips: ['Icon_BTC_Action'] },
  { label: 'Ethereum', meshes: ['Icon_ETH'], clips: ['Icon_ETH_Action'] },
];

export class OvermindPresentationSystem {
  private mixer: THREE.AnimationMixer;
  private root: THREE.Object3D;

  private armActions = new Map<string, THREE.AnimationAction>();
  private poseActions = new Map<string, THREE.AnimationAction>();
  private ringActions = new Map<string, THREE.AnimationAction>();
  private meshByName = new Map<string, THREE.Object3D>();

  private state: 'idle' | 'presenting' = 'idle';
  private returning = false;
  private restTimer = 0;
  private currentInterval: number;
  private currentObject: PresentObject | null = null;
  private cycleIndex = 0;

  // Zone de révélation (WORLD, lue depuis le node Cylinder_Trigger) + scratch.
  private zoneMesh: THREE.Object3D | null = null;
  private zoneCenter = new THREE.Vector3();
  private zoneRadius = 0;
  private zoneHeight = 0;
  private zoneHelperMat: THREE.Material | null = null;
  private tmpV = new THREE.Vector3();

  // Ondulation + suivi caméra (pilotage d'OVM_ROOT).
  private camera: THREE.Camera;
  private basePos = new THREE.Vector3();          // position Blender d'OVM_ROOT (référence du flottement).
  private elapsed = 0;
  private driftAmp = new THREE.Vector3(DRIFT_AMP.x, DRIFT_AMP.y, DRIFT_AMP.z);
  private driftSpeed = DRIFT_SPEED;
  private yawOffset = LOOK_YAW_OFFSET;
  private lookSmooth = LOOK_SMOOTH;
  private tmpCam = new THREE.Vector3();
  private tmpQuatCur = new THREE.Quaternion();
  private tmpQuatTgt = new THREE.Quaternion();
  private tmpYawQuat = new THREE.Quaternion();
  private bloomMats: THREE.MeshStandardMaterial[] = [];       // matériaux émissifs des anneaux.
  private bloomMatsIcons: THREE.MeshStandardMaterial[] = [];  // matériaux émissifs des logos BTC/ETH (intensité séparée).

  constructor(root: THREE.Object3D, animations: THREE.AnimationClip[], camera: THREE.Camera) {
    this.root = root;
    this.camera = camera;
    this.basePos.copy(root.position);             // capture la pose posée par Blender.
    this.mixer = new THREE.AnimationMixer(root);

    // 1) Bras permanents en boucle (repos) — comme au chargement historique de l'Overmind.
    let armCount = 0;
    animations.forEach((clip) => {
      if (PERMANENT_ANIMS.includes(clip.name)) {
        const a = this.mixer.clipAction(clip);
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.setEffectiveTimeScale(ARM_TIMESCALE);
        a.setEffectiveWeight(1);
        a.play();
        this.armActions.set(clip.name, a);
        armCount++;
      }
    });

    // 2) Poses (LoopOnce, clamp) — inactives au repos.
    for (const name of POSE_CLIPS) {
      const clip = THREE.AnimationClip.findByName(animations, name);
      if (!clip) { console.warn(`[OvermindPresentation] pose "${name}" absente`); continue; }
      const a = this.mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.setEffectiveTimeScale(POSE_TIMESCALE);
      // NE PAS setEffectiveWeight(0) : ça met le poids DE BASE à 0, et le crossfade calcule
      // `poidsBase × fondu` → resterait 0 (bras figés en T-pose). L'action est inerte au repos
      // simplement parce qu'elle n'est pas play()ée (poids de base laissé à 1).
      this.poseActions.set(name, a);
    }

    // 3) Anneaux (portail + tous les objets) — inactifs au repos.
    const ringClipNames = [...PORTAL_CLIPS, ...OBJECTS.flatMap((o) => o.clips)];
    for (const name of ringClipNames) {
      const clip = THREE.AnimationClip.findByName(animations, name);
      if (!clip) { console.warn(`[OvermindPresentation] clip anneau "${name}" absent`); continue; }
      const a = this.mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.setEffectiveTimeScale(RING_TIMESCALE);
      // Poids de base laissé à 1 ; inerte au repos car non play()é (cf. note poses).
      this.ringActions.set(name, a);
    }

    // 4) Cacher au repos tous les meshes de présentation (portail + les 3 objets).
    const presentationMeshNames = [...PORTAL_MESHES, ...OBJECTS.flatMap((o) => o.meshes)];
    const ICON_MESHES = new Set(['Icon_BTC', 'Icon_ETH']);
    for (const nm of presentationMeshNames) {
      const m = root.getObjectByName(nm);
      if (m) {
        m.visible = false;
        this.meshByName.set(nm, m);
        const isIcon = ICON_MESHES.has(nm);
        this.applyBloomEmissive(m, isIcon ? BLOOM_EMISSIVE_ICONS : BLOOM_EMISSIVE, isIcon ? this.bloomMatsIcons : this.bloomMats);
      } else console.warn(`[OvermindPresentation] mesh "${nm}" introuvable sous OVM_ROOT`);
    }
    console.log(`[OvermindPresentation] ${this.meshByName.size}/${presentationMeshNames.length} meshes de présentation masqués au repos : ${[...this.meshByName.keys()].join(', ')}`);

    // Zone de révélation : lire le cylindre repère posé dans Blender (enfant d'OVM_ROOT).
    this.zoneMesh = root.getObjectByName(ZONE_MESH_NAME) ?? null;
    if (this.zoneMesh) {
      if (SHOW_ZONE_HELPER) {
        // Le mesh du GLB est plein : on le passe en wireframe non-occultant pour visualiser la zone.
        this.zoneHelperMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, transparent: true, opacity: 0.5, depthTest: false });
        (this.zoneMesh as THREE.Mesh).material = this.zoneHelperMat;
        this.zoneMesh.renderOrder = 999;
        this.zoneMesh.visible = true;
      } else {
        this.zoneMesh.visible = false;
      }
      this.computeZoneFromMesh();
      console.log(`[OvermindPresentation] zone lue depuis ${ZONE_MESH_NAME} : centre=(${this.zoneCenter.x.toFixed(2)},${this.zoneCenter.y.toFixed(2)},${this.zoneCenter.z.toFixed(2)}) r=${this.zoneRadius.toFixed(2)} h=${this.zoneHeight.toFixed(2)}`);
    } else {
      console.warn(`[OvermindPresentation] node "${ZONE_MESH_NAME}" introuvable — pas de zone, meshes montrés en plein pendant la présentation`);
    }

    window.addEventListener('overmind:tune', this.onTune as EventListener);
    this.mixer.addEventListener('finished', this.onMixerFinished);
    this.currentInterval = this.pickInterval();
    console.log(`[OvermindPresentation] prêt : ${armCount} bras en boucle, ${this.poseActions.size} poses, ${this.ringActions.size} anneaux. 1ʳᵉ présentation dans ${this.currentInterval.toFixed(0)}s (TEST_MODE=${TEST_MODE}).`);
  }

  update(dt: number): void {
    this.mixer.update(dt);
    this.applyDriftAndLook(dt);   // flottement + orientation d'OVM_ROOT (le mixer n'a touché que les bones)
    if (this.state === 'idle') {
      this.restTimer += dt;
      if (this.restTimer >= this.currentInterval) this.startPresentation();
    } else {
      // Révélation par zone : après mixer.update (positions à jour), tester chaque mesh actif.
      this.updateRevealVisibility();
    }
  }

  private startPresentation(): void {
    const obj = this.pickObject();
    this.currentObject = obj;

    // Ne PAS montrer les meshes d'un coup : la visibilité est pilotée par la zone de révélation
    // dans update() (cachés dans la zone, dévoilés en montant). Au repos ils sont déjà invisibles.

    // Bras R1/R2 → poses (crossfade). Les autres bras continuent en boucle.
    // reset() remet time=0 + enabled sans toucher au poids de base (=1) ; crossFadeFrom fait
    // monter la pose de 0→1 et descendre le bras de 1→0 (poids effectif = base × fondu).
    for (const poseName of POSE_CLIPS) {
      const pose = this.poseActions.get(poseName);
      if (!pose) continue;
      pose.reset();
      pose.setEffectiveTimeScale(POSE_TIMESCALE);
      pose.play();
      const arm = this.armActions.get(POSE_ARM[poseName]);
      if (arm) pose.crossFadeFrom(arm, FADE_DURATION, false);
    }

    // Portail + clips de l'objet : jouer d'un coup (poids de base 1, le clip part du repos).
    for (const rn of [...PORTAL_CLIPS, ...obj.clips]) {
      const a = this.ringActions.get(rn);
      if (!a) continue;
      a.reset();
      a.setEffectiveTimeScale(RING_TIMESCALE);
      a.play();
    }

    this.state = 'presenting';
    this.returning = false;
    console.log(`[OvermindPresentation] ▶ présentation « ${obj.label} »`);
  }

  private returnToArms(): void {
    this.returning = true;

    // Poses → bras (crossfade inverse).
    for (const poseName of POSE_CLIPS) {
      const pose = this.poseActions.get(poseName);
      const arm = this.armActions.get(POSE_ARM[poseName]);
      if (!pose || !arm) continue;
      arm.enabled = true;
      arm.setEffectiveTimeScale(ARM_TIMESCALE);
      arm.play();
      arm.crossFadeFrom(pose, FADE_DURATION, false);
    }

    // Recacher les objets (déjà « refermés » à la dernière frame des clips) puis stopper les anneaux.
    this.setMeshesVisible(PORTAL_MESHES, false);
    if (this.currentObject) this.setMeshesVisible(this.currentObject.meshes, false);
    for (const rn of [...PORTAL_CLIPS, ...(this.currentObject?.clips ?? [])]) {
      this.ringActions.get(rn)?.stop();
    }

    this.currentObject = null;
    this.state = 'idle';
    this.restTimer = 0;
    this.currentInterval = this.pickInterval();
    console.log(`[OvermindPresentation] ↩ retour bras — prochaine présentation dans ${this.currentInterval.toFixed(0)}s`);
  }

  private onMixerFinished = (e: { action: THREE.AnimationAction }): void => {
    const name = e.action?.getClip?.().name;
    // Le retour se déclenche à la fin d'UNE pose (les 2 finissent ~ensemble → garde `returning`).
    if (this.state === 'presenting' && !this.returning && (name === 'R1&R2_Pose' || name === 'R2&R1_Pose')) {
      this.returnToArms();
    }
  };

  /** Révélation par zone : chaque mesh actif (portail + objet courant) est caché DANS la zone
   *  (repère local OVM_ROOT), visible DEHORS → il se dévoile en montant (effet portail). */
  private updateRevealVisibility(): void {
    const active = this.currentObject ? [...PORTAL_MESHES, ...this.currentObject.meshes] : PORTAL_MESHES;
    for (const nm of active) {
      const m = this.meshByName.get(nm);
      if (!m) continue;
      if (!this.zoneMesh) { m.visible = true; continue; }    // pas de zone → montrer (fallback)
      m.getWorldPosition(this.tmpV);                          // (met aussi à jour OVM_ROOT.matrixWorld)
      this.root.worldToLocal(this.tmpV);                     // → repère LOCAL OVM_ROOT (invariant ondulation/lookAt)
      const dx = this.tmpV.x - this.zoneCenter.x;
      const dz = this.tmpV.z - this.zoneCenter.z;
      const horiz = Math.sqrt(dx * dx + dz * dz);             // distance horizontale (cylindre vertical)
      const inZone = horiz <= this.zoneRadius && Math.abs(this.tmpV.y - this.zoneCenter.y) <= this.zoneHeight;
      m.visible = !inZone;                                    // caché DANS le cylindre, visible DEHORS
    }
  }

  /** Flottement doux d'OVM_ROOT autour de sa pose Blender + orientation lissée vers la caméra.
   *  Le mixer n'anime que les bones internes → on est libres de piloter position + quaternion. */
  private applyDriftAndLook(dt: number): void {
    this.elapsed += dt;
    const e = this.elapsed * this.driftSpeed;
    // Ondulation (fréquences non-commensurables → pas de battement visible).
    this.root.position.set(
      this.basePos.x + Math.sin(e * 0.70) * this.driftAmp.x,
      this.basePos.y + Math.sin(e * 0.53 + 1.3) * this.driftAmp.y,
      this.basePos.z + Math.cos(e * 0.61 + 2.1) * this.driftAmp.z,
    );
    // Suivi caméra : tout OVM_ROOT s'oriente vers la caméra (lookAt gère parent→local), lissé.
    if (LOOK_AT_CAMERA) {
      this.tmpQuatCur.copy(this.root.quaternion);      // orientation courante
      this.camera.getWorldPosition(this.tmpCam);
      this.root.lookAt(this.tmpCam);                    // root.quaternion = cible (locale, parent géré)
      if (this.yawOffset !== 0) {
        this.tmpYawQuat.setFromAxisAngle(UP, this.yawOffset);
        this.root.quaternion.multiply(this.tmpYawQuat);
      }
      this.tmpQuatTgt.copy(this.root.quaternion);       // cible
      this.root.quaternion.copy(this.tmpQuatCur).slerp(this.tmpQuatTgt, this.lookSmooth);
    }
  }

  /** Réglage live : window.dispatchEvent(new CustomEvent('overmind:tune', { detail:{ driftX, driftY,
   *  driftZ, driftSpeed, yawOffset, lookSmooth } })). */
  private onTune = (e: Event): void => {
    const d = (e as CustomEvent).detail || {};
    if (typeof d.driftX === 'number') this.driftAmp.x = d.driftX;
    if (typeof d.driftY === 'number') this.driftAmp.y = d.driftY;
    if (typeof d.driftZ === 'number') this.driftAmp.z = d.driftZ;
    if (typeof d.driftSpeed === 'number') this.driftSpeed = d.driftSpeed;
    if (typeof d.yawOffset === 'number') this.yawOffset = d.yawOffset;
    if (typeof d.lookSmooth === 'number') this.lookSmooth = d.lookSmooth;
    if (typeof d.bloom === 'number') for (const m of this.bloomMats) { m.emissiveIntensity = d.bloom; m.needsUpdate = true; }
    if (typeof d.bloomIcons === 'number') for (const m of this.bloomMatsIcons) { m.emissiveIntensity = d.bloomIcons; m.needsUpdate = true; }
    console.log(`[OvermindPresentation] tune : drift=(${this.driftAmp.x},${this.driftAmp.y},${this.driftAmp.z}) speed=${this.driftSpeed} yaw=${this.yawOffset} smooth=${this.lookSmooth} bloom=${this.bloomMats[0]?.emissiveIntensity ?? '?'} bloomIcons=${this.bloomMatsIcons[0]?.emissiveIntensity ?? '?'}`);
  };

  /** Recalcule la zone (centre/rayon/demi-hauteur, en WORLD) depuis la bbox du node Cylinder_Trigger.
   *  Appelé au chargement et au début de chaque présentation (capte la pose courante d'OVM_ROOT). */
  private computeZoneFromMesh(): void {
    const cyl = this.zoneMesh as THREE.Mesh | null;
    if (!cyl || !(cyl.geometry instanceof THREE.BufferGeometry)) return;
    if (!cyl.geometry.boundingBox) cyl.geometry.computeBoundingBox();
    const bb = cyl.geometry.boundingBox!;
    // Zone en repère LOCAL OVM_ROOT (INVARIANT à l'ondulation/lookAt qui déplacent OVM_ROOT chaque
    // frame) : centre = position locale du cylindre ; rayon/demi-hauteur = demi-dimensions géo × scale
    // local. Fixe → calculé une fois au chargement.
    this.zoneCenter.copy(cyl.position);
    const sx = Math.abs(cyl.scale.x), sy = Math.abs(cyl.scale.y), sz = Math.abs(cyl.scale.z);
    this.zoneRadius = Math.max((bb.max.x - bb.min.x) * sx, (bb.max.z - bb.min.z) * sz) * 0.5;
    this.zoneHeight = (bb.max.y - bb.min.y) * sy * 0.5;
  }

  /** Rend un objet de présentation émissif → capté par le bloom. On CLONE le matériau (les
   *  matériaux "alien-panels"/"BloomArea"/"Bloom_*" peuvent être partagés → éviter de faire
   *  briller d'autres objets). L'émissif = la texture de base si présente, sinon la couleur de base. */
  private applyBloomEmissive(obj: THREE.Object3D, intensity: number, store: THREE.MeshStandardMaterial[]): void {
    obj.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const src = Array.isArray(child.material) ? child.material : [child.material];
      const out = src.map((mat) => {
        const c = mat.clone() as THREE.MeshStandardMaterial;
        if (!('emissive' in c)) return c;
        if (c.map) { c.emissiveMap = c.map; c.emissive.setRGB(1, 1, 1); }   // brille de sa texture
        else c.emissive.copy(c.color);                                       // brille de sa couleur
        c.emissiveIntensity = intensity;
        c.needsUpdate = true;
        store.push(c);
        return c;
      });
      child.material = Array.isArray(child.material) ? out : out[0];
    });
  }

  private setMeshesVisible(names: string[], visible: boolean): void {
    for (const n of names) {
      const m = this.meshByName.get(n);
      if (m) m.visible = visible;
    }
  }

  private pickObject(): PresentObject {
    if (TEST_MODE) {
      const obj = OBJECTS[this.cycleIndex % OBJECTS.length];
      this.cycleIndex++;
      return obj;
    }
    return OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  }

  private pickInterval(): number {
    if (TEST_MODE) return TEST_INTERVAL_S;
    return FINAL_MIN_S + Math.random() * (FINAL_MAX_S - FINAL_MIN_S);
  }

  dispose(): void {
    window.removeEventListener('overmind:tune', this.onTune as EventListener);
    if (this.zoneHelperMat) { this.zoneHelperMat.dispose(); this.zoneHelperMat = null; }
    for (const m of this.bloomMats) m.dispose();
    for (const m of this.bloomMatsIcons) m.dispose();
    this.bloomMats.length = 0;
    this.bloomMatsIcons.length = 0;
    this.mixer.removeEventListener('finished', this.onMixerFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root as THREE.Object3D);
    this.armActions.clear();
    this.poseActions.clear();
    this.ringActions.clear();
    this.meshByName.clear();
  }
}
