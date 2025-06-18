import type { StandardMaterialParams } from './materialUtils';

export const anneauxPresets: Record<string, StandardMaterialParams> = {
  ringStrong: {
    color: "#00ffff", // Cyan plus visible
    emissive: "#0088ff", // Bleu émissif
    emissiveIntensity: 0.8, // Réduire l'intensité
    metalness: 0.9,
    roughness: 0.1,
    toneMapped: true, // Changer pour true
    bloomLayer: 2,
  },
  ringSoft: {
    color: "#ff4400", // Orange plus visible
    emissive: "#ff2200", // Rouge émissif
    emissiveIntensity: 0.5, // Réduire l'intensité
    metalness: 0.7,
    roughness: 0.3,
    toneMapped: true, // Changer pour true
    bloomLayer: 2,
  }
};