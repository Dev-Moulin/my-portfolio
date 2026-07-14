import * as THREE from 'three';
import { extractZoneGeometry, type ZoneGeometry } from './wanderNavigation.ts';

/**
 * Système de présence de l'Overmind (l'œil V4.2) à côté de la carte C.
 *
 * Remplace l'ancien pilotage Yuka : l'œil dérive DOUCEMENT à l'intérieur d'un volume
 * `WanderOvermind` (cube exporté depuis Blender, espace GLB-local du vaisseau) sans
 * jamais en sortir, et reste ORIENTÉ vers la caméra (face spectateur).
 *
 * La zone vit dans le modèle vaisseau (GLB-local) ; la position calculée est convertie
 * en monde via `spaceshipModel.localToWorld`, puis appliquée à l'œil (`modelRef`).
 */

const FILL = 0.7;          // remplissage de la bbox par la dérive (la cible reste dans 70%)
const POS_SMOOTH = 0.02;   // lissage de position (flotte lentement)
const LOOK_SMOOTH = 0.08;  // lissage d'orientation (face caméra)

export interface OvermindZoneConfig {
  enabled: boolean;
  amplitude: number; // facteur de dérive (1 = défaut ; 0 = immobile au centre)
  speed: number;     // vitesse de la dérive
  scale: number;     // échelle de l'œil
  yawOffset: number; // correction d'orientation (rad) si l'œil regarde à l'envers
}

export const OVERMIND_ZONE_DEFAULTS: OvermindZoneConfig = {
  // yawOffset = π : l'œil V4.2 a son « avant » à l'opposé de la convention lookAt (-Z),
  // donc on le retourne de 180° pour qu'il fasse face à la caméra.
  enabled: true, amplitude: 1, speed: 1, scale: 0.15, yawOffset: Math.PI,
};

export class OvermindZoneSystem {
  enabled: boolean;
  amplitude: number;
  speed: number;
  scale: number;
  yawOffset: number;

  private model: THREE.Object3D;       // vaisseau (la zone est en GLB-local de ce modèle)
  private camera: THREE.Camera;
  private zone: ZoneGeometry | null;
  private elapsed = 0;
  private logged = false;              // log diagnostic une seule fois (position monde de l'œil)

  // temps (zéro alloc en boucle)
  private posGlb = new THREE.Vector3();
  private wTarget = new THREE.Vector3();
  private worldPos = new THREE.Vector3();
  private camWorld = new THREE.Vector3();
  private lookMat = new THREE.Matrix4();
  private lookQuat = new THREE.Quaternion();
  private yawQuat = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(spaceshipModel: THREE.Object3D, camera: THREE.Camera, cfg: OvermindZoneConfig) {
    this.model = spaceshipModel;
    this.camera = camera;
    this.enabled = cfg.enabled;
    this.amplitude = cfg.amplitude;
    this.speed = cfg.speed;
    this.scale = cfg.scale;
    this.yawOffset = cfg.yawOffset;
    // L'Overmind dérive DANS le volume `WanderOvermind` (box dédiée, espace GLB-local).
    this.zone = extractZoneGeometry(spaceshipModel, 'WanderOvermind');
    if (this.zone) {
      this.posGlb.copy(this.zone.center);
      const c = this.zone.center;
      console.log(`[overmindZone] WanderOvermind OK: center=(${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}) ${this.zone.tris.length} tris`);
    } else {
      console.warn('[overmindZone] WanderOvermind introuvable — l\'Overmind reste piloté par Yuka');
    }
  }

  hasZone(): boolean { return this.zone !== null; }

  setConfig(c: Partial<OvermindZoneConfig>): void {
    if (c.enabled !== undefined) this.enabled = c.enabled;
    if (c.amplitude !== undefined) this.amplitude = c.amplitude;
    if (c.speed !== undefined) this.speed = c.speed;
    if (c.scale !== undefined) this.scale = c.scale;
    if (c.yawOffset !== undefined) this.yawOffset = c.yawOffset;
  }

  getConfig(): OvermindZoneConfig {
    return {
      enabled: this.enabled, amplitude: this.amplitude, speed: this.speed,
      scale: this.scale, yawOffset: this.yawOffset,
    };
  }

  /** Positionne `eye` dans le volume de la zone (dérive douce confinée) + l'oriente caméra. */
  update(dt: number, eye: THREE.Object3D): void {
    const z = this.zone;
    if (!z) return;
    this.elapsed += dt * this.speed;
    const e = this.elapsed * 0.5;

    const cx = (z.bboxMin.x + z.bboxMax.x) * 0.5;
    const cy = (z.bboxMin.y + z.bboxMax.y) * 0.5;
    const cz = (z.bboxMin.z + z.bboxMax.z) * 0.5;
    const hx = (z.bboxMax.x - z.bboxMin.x) * 0.5 * FILL * this.amplitude;
    const hy = (z.bboxMax.y - z.bboxMin.y) * 0.5 * FILL * this.amplitude;
    const hz = (z.bboxMax.z - z.bboxMin.z) * 0.5 * FILL * this.amplitude;

    // Dérive sinusoïdale (fréquences non-commensurables) clampée DANS le volume → ne sort jamais.
    this.wTarget.set(
      THREE.MathUtils.clamp(cx + Math.sin(e * 0.26) * hx, z.bboxMin.x, z.bboxMax.x),
      THREE.MathUtils.clamp(cy + Math.sin(e * 0.34 + 1.3) * hy, z.bboxMin.y, z.bboxMax.y),
      THREE.MathUtils.clamp(cz + Math.cos(e * 0.21 + 2.1) * hz, z.bboxMin.z, z.bboxMax.z),
    );
    this.posGlb.lerp(this.wTarget, POS_SMOOTH);
    this.worldPos.copy(this.posGlb);
    this.model.localToWorld(this.worldPos);
    eye.position.copy(this.worldPos);
    eye.scale.setScalar(this.scale);

    if (!this.logged) {
      this.logged = true;
      console.log(`[overmindZone] œil placé en monde=(${this.worldPos.x.toFixed(1)},${this.worldPos.y.toFixed(1)},${this.worldPos.z.toFixed(1)}) scale=${this.scale} visible=${eye.visible} name=${eye.name}`);
    }

    // Orientation : regarde la caméra (lissé) + correction yaw éventuelle
    this.camera.getWorldPosition(this.camWorld);
    this.lookMat.lookAt(this.worldPos, this.camWorld, this.up);
    this.lookQuat.setFromRotationMatrix(this.lookMat);
    if (this.yawOffset !== 0) {
      this.yawQuat.setFromAxisAngle(this.up, this.yawOffset);
      this.lookQuat.multiply(this.yawQuat);
    }
    eye.quaternion.slerp(this.lookQuat, LOOK_SMOOTH);
  }
}
