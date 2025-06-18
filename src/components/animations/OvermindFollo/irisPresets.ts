import type { StandardMaterialParams } from './materialUtils';

export const irisPresets: Record<string, StandardMaterialParams> = {
  neonBlue: {
    color: "#0066ff", // Bleu plus visible
    emissive: "#0044bb", // Émissif plus doux
    emissiveIntensity: 0.6, // Réduire l'intensité
    toneMapped: true, // Changer pour true
    bloomLayer: 1,
  },
  alertRed: {
    color: "#ff0033",
    emissive: "#ff0033",
    emissiveIntensity: 0.6,
    toneMapped: true,
    bloomLayer: 1,
  },
  calmGreen: {
    color: "#00ff88",
    emissive: "#00ff88",
    emissiveIntensity: 0.6,
    toneMapped: true,
    bloomLayer: 2,
  },
};