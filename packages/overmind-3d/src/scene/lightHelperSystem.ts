import * as THREE from 'three';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';

/**
 * Manages Three.js light helpers — visual gizmos that show light position,
 * direction, and range in the viewport (Blender-style).
 */
export class LightHelperSystem {
  private helpers = new Map<string, THREE.Object3D>();
  private scene: THREE.Scene;
  private visible = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Attach a visual helper to a light. Replaces any existing helper for this id. */
  attach(id: string, light: THREE.Light): void {
    this.detach(id);
    let helper: THREE.Object3D | null = null;

    if (light instanceof THREE.SpotLight) {
      helper = new THREE.SpotLightHelper(light);
    } else if (light instanceof THREE.PointLight) {
      helper = new THREE.PointLightHelper(light, 0.5);
    } else if (light instanceof THREE.DirectionalLight) {
      helper = new THREE.DirectionalLightHelper(light, 1);
    } else if (light instanceof THREE.RectAreaLight) {
      helper = new RectAreaLightHelper(light);
    }
    // AmbientLight has no spatial representation — skip

    if (!helper) {
      console.warn(`[lightHelpers] "${id}" : type ${light.type} sans helper visuel (ex. AmbientLight) → ignoré`);
      return;
    }
    helper.visible = this.visible;
    this.scene.add(helper);
    this.helpers.set(id, helper);
    console.log(`[lightHelpers] attach "${id}" (${light.type}) visible=${this.visible} → ${this.helpers.size} helper(s) au total`);
  }

  /** Remove and dispose helper for a given light id. */
  detach(id: string): void {
    const h = this.helpers.get(id);
    if (!h) return;
    this.scene.remove(h);
    if ('dispose' in h && typeof (h as { dispose: () => void }).dispose === 'function') {
      (h as { dispose: () => void }).dispose();
    }
    this.helpers.delete(id);
  }

  /** Show or hide all helpers at once. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const h of this.helpers.values()) {
      h.visible = visible;
    }
    console.log(`[lightHelpers] setVisible(${visible}) → ${this.helpers.size} helper(s) ${this.helpers.size === 0 ? '(AUCUNE lumière-instance dans la scène → rien à afficher)' : ''}`);
  }

  /** Call every frame — helpers must be updated when their light moves. */
  update(): void {
    for (const h of this.helpers.values()) {
      if ('update' in h && typeof (h as { update: () => void }).update === 'function') {
        (h as { update: () => void }).update();
      }
    }
  }

  dispose(): void {
    for (const id of [...this.helpers.keys()]) {
      this.detach(id);
    }
  }
}
