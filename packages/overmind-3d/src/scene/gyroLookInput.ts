import * as THREE from 'three';
import type { ScrollCameraAnimator } from './scrollCameraAnimator.ts';

// ── Gyro look input (MOBILE) ─────────────────────────────────────────────────
//  « Regarder autour » léger via l'orientation de l'appareil, calqué sur le look-around desktop :
//  FAIBLE, PLAFONNÉ, jamais gênant. On reconstruit le QUATERNION d'orientation complet (méthode
//  DeviceOrientationControls de Three.js) plutôt que lire beta/gamma bruts : les angles d'Euler
//  bruts se COUPLENT aux fortes inclinaisons (le haut/bas bave sur le gauche/droite → regard en
//  diagonale). Le quaternion extrait proprement gauche/droite (Y) et haut/bas (X), sans couplage.
//
//  On mesure le DELTA d'orientation depuis une référence prise à l'activation (l'utilisateur tient
//  son téléphone comme il veut au départ), avec DEADZONE (anti-tremblement) et CLAMP d'amplitude.
//  Le résultat alimente freeYaw/freePitch de l'animator → neutralisation hors repos GRATUITE (`* w`).
//
//  Activation : event `overmind:gyro-toggle` { enabled } émis par le bouton NavArc mobile. iOS ≥13
//  exige une permission (gérée côté NavArc, qui n'émet l'event que si accordée). Ici on écoute.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_YAW_DEG = 55;    // amplitude max du regard horizontal (retour Paul : 55°)
const MAX_PITCH_DEG = 37;  // amplitude max du regard vertical (proportionnel au yaw)
const DEADZONE_DEG = 3;    // sous ce delta → 0 (pas de dérive au tremblement)
const GAIN = 2.2;          // sensibilité orientation appareil → regard (atteint le max sans incliner à 45°)

const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _screenQ = new THREE.Quaternion();
// −π/2 autour de X : la « caméra » regarde par l'arrière de l'appareil (convention DeviceOrientation).
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

/** Orientation appareil (alpha,beta,gamma en RAD + angle écran) → quaternion monde. */
function deviceQuaternion(out: THREE.Quaternion, alpha: number, beta: number, gamma: number, orient: number): void {
  _euler.set(beta, alpha, -gamma, 'YXZ');                  // ordre imposé par l'API
  out.setFromEuler(_euler);
  out.multiply(_q1);                                       // regarde par l'arrière de l'appareil
  out.multiply(_screenQ.setFromAxisAngle(_zee, -orient));  // corrige l'orientation de l'écran (paysage)
}

/** Branche l'écoute gyroscope sur l'animator, pilotée par l'event `overmind:gyro-toggle`.
 *  Retourne un détacheur (à appeler au dispose de la scène). */
export function attachGyroLook(animator: ScrollCameraAnimator): () => void {
  let listening = false;
  let haveRef = false;
  const qRef = new THREE.Quaternion();   // orientation neutre prise à l'activation
  const qCur = new THREE.Quaternion();
  const qDelta = new THREE.Quaternion();
  const eDelta = new THREE.Euler();

  // Deadzone + gain + clamp sur un angle (deg) → deg de regard.
  const shape = (deg: number, max: number): number => {
    const a = Math.abs(deg);
    if (a <= DEADZONE_DEG) return 0;
    return Math.sign(deg) * Math.min(max, (a - DEADZONE_DEG) * GAIN);
  };

  const screenAngleRad = (): number => {
    const modern = window.screen?.orientation?.angle;
    const legacy = (window as unknown as { orientation?: number }).orientation;
    const deg = typeof modern === 'number' ? modern : typeof legacy === 'number' ? legacy : 0;
    return THREE.MathUtils.degToRad(deg);
  };

  const onOrient = (e: DeviceOrientationEvent): void => {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    const alpha = THREE.MathUtils.degToRad(e.alpha ?? 0);
    const beta = THREE.MathUtils.degToRad(e.beta ?? 0);
    const gamma = THREE.MathUtils.degToRad(e.gamma ?? 0);
    deviceQuaternion(qCur, alpha, beta, gamma, screenAngleRad());
    // 1re mesure après activation = référence neutre (peu importe comment le tél est tenu).
    if (!haveRef) { qRef.copy(qCur); haveRef = true; return; }
    // Rotation DEPUIS la référence, extraite proprement (sans couplage) : Y = gauche/droite, X = haut/bas.
    qDelta.copy(qRef).invert().multiply(qCur);
    eDelta.setFromQuaternion(qDelta, 'YXZ');
    const yawDeg = shape(THREE.MathUtils.radToDeg(eDelta.y), MAX_YAW_DEG);
    const pitchDeg = shape(THREE.MathUtils.radToDeg(eDelta.x), MAX_PITCH_DEG);
    animator.setGyroLook(THREE.MathUtils.degToRad(yawDeg), THREE.MathUtils.degToRad(pitchDeg));
  };

  const start = (): void => {
    if (listening) return;
    haveRef = false; // nouvelle référence neutre à chaque activation
    window.addEventListener('deviceorientation', onOrient);
    listening = true;
    animator.setGyroEnabled(true);
  };
  const stop = (): void => {
    if (!listening) return;
    window.removeEventListener('deviceorientation', onOrient);
    listening = false;
    animator.setGyroEnabled(false); // ramène le regard à 0 (lissé)
  };

  const onToggle = (e: Event): void => {
    const on = (e as CustomEvent<{ enabled: boolean }>).detail?.enabled === true;
    if (on) start(); else stop();
  };
  window.addEventListener('overmind:gyro-toggle', onToggle);

  return () => {
    stop();
    window.removeEventListener('overmind:gyro-toggle', onToggle);
  };
}
