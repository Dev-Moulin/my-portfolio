import * as THREE from 'three';

/**
 * FrameGlowSystem — glow émissif contrôlable sur le CADRE de la carte Holo en B
 * (mesh GLB `Cadre_gameasset.009`). Utilisé par l'onboarding (étape « écran holo ») pour
 * DÉSIGNER la carte par un halo pulsant, avant que l'utilisateur ne la manipule.
 *
 * - Le bloom global de la scène capte l'émissif → halo lumineux (même principe que LinkSystem
 *   pour les logos réseaux/CV : pas de layer sélectif, on joue sur `emissiveIntensity`).
 * - Matériau CLONÉ par mesh → glow ISOLÉ (si le matériau du cadre est partagé avec d'autres
 *   cartes, seul CE cadre brille).
 * - `setGlow(i)` pendant le pulse ; `reset()` restaure l'émissif de repos capturé au démarrage.
 */

// Blender/GLTF retire les points à l'export : `Cadre_gameasset.009` → `Cadre_gameasset009`.
const FRAME_NAME = 'Cadre_gameasset.009';
const GLOW_COLOR = new THREE.Color(0x00d0fa); // cyan accent (même teinte que la bulle du tuto)

export class FrameGlowSystem {
  private meshes: THREE.Mesh[] = [];
  private baseEmissive: { color: THREE.Color; intensity: number }[] = [];

  constructor(model: THREE.Object3D) {
    const root =
      model.getObjectByName(FRAME_NAME) ??
      model.getObjectByName(FRAME_NAME.replace(/\./g, '')) ??
      null;
    if (!root) { console.warn(`[frameGlow] ${FRAME_NAME} introuvable dans le GLB`); return; }

    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Clone du matériau → glow isolé (le matériau GLB peut être partagé entre cadres).
      m.material = Array.isArray(m.material)
        ? m.material.map((mm) => mm.clone())
        : (m.material as THREE.Material).clone();
      this.meshes.push(m);
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      this.baseEmissive.push({
        color: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
        intensity: mat.emissiveIntensity ?? 1,
      });
    });
    console.log(`[frameGlow] cadre « ${FRAME_NAME} » prêt (${this.meshes.length} mesh)`);
  }

  /** Applique un glow cyan de l'intensité donnée (pulse onboarding). */
  setGlow(intensity: number): void {
    for (const m of this.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) {
        const mat = mm as THREE.MeshStandardMaterial;
        if (mat.emissive) { mat.emissive.copy(GLOW_COLOR); mat.emissiveIntensity = intensity; }
      }
    }
  }

  /** Restaure l'émissif de repos (capturé au chargement). */
  reset(): void {
    this.meshes.forEach((m, i) => {
      const base = this.baseEmissive[i];
      if (!base) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) {
        const mat = mm as THREE.MeshStandardMaterial;
        if (mat.emissive) { mat.emissive.copy(base.color); mat.emissiveIntensity = base.intensity; }
      }
    });
  }
}
