import * as THREE from 'three';

/**
 * Profil de mouvement BAKÉ de la sentinelle sur le trajet AB (Sentinel_AB_motion_profile.json).
 *
 * Pourquoi : sur AB, la sentinelle n'est PAS à vitesse constante — c'est un ease-in/out
 * (offset_factor Bézier, pic au milieu ~frame 249) + deux vrilles 360° (BANK_CTRL.Y, dont
 * −880° ≈ 2,4 tours vers frame 318). Suivre la courbe avec un t linéaire + ressort
 * désynchronise de la caméra et tue l'effet « la sentinelle rattrape et passe devant ».
 * On rejoue donc le profil FRAME PAR FRAME, calé sur la frame de la caméra → choré exacte.
 *
 * `pos_three` est déjà dans le repère three Y-up = espace GLB-local (identique à la courbe AB).
 * Les frames vont de 1 à 499 (pas de 1). La caméra AB joue les frames 53→500 (52 frames de
 * décalage) → on échantillonne le profil à la frame caméra courante.
 */

export interface ABMotionProfile {
  /** Positions GLB-local, `subdivision` échantillons par frame Blender. */
  pos: THREE.Vector3[];
  /** Roll (rad), même indexation que `pos`. */
  rollRad: number[];
  frameStart: number; // 1
  frameEnd: number;   // 499 (V1) / 500 (V2.3)
  /** Échantillons par frame entière (V1 = 1 ; V2.3 = 4, `f` fractionnaire i/4). */
  subdivision: number;
}

/** Plage de frames du clip caméra AB dans Blender (ActionAB). */
export const AB_CAM_FRAME_START = 53;
export const AB_CAM_FRAME_END = 500;

export async function loadABMotionProfile(basePath: string): Promise<ABMotionProfile> {
  const url = `${basePath}data/Sentinel_AB_motion_profile.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[abProfile] failed to load ${url}: ${res.status}`);
  const raw = await res.json();
  const sp = raw.speed_profile as Array<{ f: number; pos_three: [number, number, number]; roll_y_deg: number }>;
  const pos: THREE.Vector3[] = [];
  const rollRad: number[] = [];
  for (const s of sp) {
    pos.push(new THREE.Vector3(...s.pos_three));
    rollRad.push((s.roll_y_deg * Math.PI) / 180);
  }
  const frameStart = raw.frame_range?.[0] ?? 1;
  const frameEnd = raw.frame_range?.[1] ?? sp.length;
  // V2.3 : profil 4× densité (`subdivision:4`, f fractionnaire i/4). V1 : 1 éch./frame.
  const subdivision = raw.subdivision ?? 1;
  console.log(`[abProfile] loaded ${sp.length} samples (${frameStart}→${frameEnd}, subdivision=${subdivision})`);
  return { pos, rollRad, frameStart, frameEnd, subdivision };
}

/**
 * Échantillonne le profil à une frame fractionnaire (interp linéaire).
 * @param frame  frame Blender (sera clampée à [frameStart, frameEnd])
 */
export function sampleABProfile(
  p: ABMotionProfile, frame: number, outPos: THREE.Vector3,
): number {
  const f = Math.max(p.frameStart, Math.min(p.frameEnd, frame));
  const idx = (f - p.frameStart) * p.subdivision; // index flottant (× éch./frame)
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, p.pos.length - 1);
  const a = idx - i0;
  outPos.copy(p.pos[i0]).lerp(p.pos[i1], a);
  // Roll : interp linéaire (les valeurs sont déjà continues, multi-tours)
  return p.rollRad[i0] + (p.rollRad[i1] - p.rollRad[i0]) * a;
}
