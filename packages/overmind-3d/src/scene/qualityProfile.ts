/**
 * Profil de qualité — LE point central des leviers de rendu (Voie B mobile).
 *
 * Diagnostic télémétrie 2026-07-22 (iPhone 13 mini, dpr=3) : médiane 21 FPS, 31 % du temps
 * sous 20, et 5 morts SILENCIEUSES (Safari tue l'onglet pour excès mémoire — aucune erreur JS).
 * Cause : le tier desktop intégral tournait sur mobile (DPR 2, antialias MSAA, OutlinePass
 * pleine résolution, bloom half-res). Ce module choisit un tier au boot et TOUS les
 * consommateurs (sceneSetup, resize, systèmes optionnels) lisent le même profil.
 *
 * Heuristique : pointeur PRIMAIRE « coarse » (doigt) = téléphone/tablette → tier low.
 * Un laptop tactile garde un pointeur primaire fin (souris/trackpad) → tier high.
 * `detect-gpu` en option future si l'heuristique ne suffit pas (décision Paul : maison d'abord).
 *
 * ⚠️ Tier low : l'OutlinePass n'est PAS ajouté au composer (l'outline de sélection est un
 * outil d'atelier, invisible pour un visiteur tactile) et la bulle glow du SKIP est coupée
 * (placement NDC non raccord sur petit écran — décision Paul 2026-07-22 ; le bouton DOM suffit).
 */

export type QualityTier = 'high' | 'low';

export interface QualityProfile {
  tier: QualityTier;
  /** Plafond de devicePixelRatio appliqué au renderer (iPhone annonce 3 !). */
  maxDpr: number;
  antialias: boolean;
  /** Ajouter l'OutlinePass (post-effect sélection, coût pleine résolution) au composer ? */
  outlinePass: boolean;
  /** Échelle de résolution des render targets du bloom (1 = pleine résolution). */
  bloomResolutionScale: number;
  /** Multiplicateur du strength bloom appliqué au pass (transparent pour l'UI/keyframes) —
   *  sur mobile le bloom paraît plus faible (petit écran OLED, DPR plafonné) → compensation. */
  bloomStrengthBoost: number;
  /** Bulle de glow 3D derrière le bouton SKIP (HUD NDC). */
  skipGlow: boolean;
}

let cached: QualityProfile | null = null;

export function getQualityProfile(): QualityProfile {
  if (cached) return cached;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = window.devicePixelRatio || 1;
  cached = coarse
    ? {
        tier: 'low',
        maxDpr: 1.5,
        // Décision Paul : antialias GARDÉ sur mobile (le lissage fait partie du look).
        // Si la télémétrie montre un jour un coût FPS prohibitif, on en reparlera chiffres en main.
        antialias: true,
        outlinePass: false,
        // Décision Paul : le bloom est l'identité visuelle du portfolio → même résolution
        // que le desktop dense (pas de dégradation du look néon sur mobile).
        bloomResolutionScale: 0.5,
        bloomStrengthBoost: 1.3,
        skipGlow: false,
      }
    : {
        tier: 'high',
        maxDpr: 2,
        antialias: true,
        outlinePass: true,
        // Comportement historique conservé : écrans denses → bloom half-res, sinon pleine.
        bloomResolutionScale: dpr > 1 ? 0.5 : 1.0,
        bloomStrengthBoost: 1.0,
        skipGlow: true,
      };
  // Contexte pour la télémétrie dev (perfTelemetry écoute les overmind:*).
  window.dispatchEvent(new CustomEvent('overmind:quality-tier', { detail: cached.tier }));
  console.log(`[quality] tier=${cached.tier} (dpr=${dpr} → plafonné ${cached.maxDpr})`);
  return cached;
}
