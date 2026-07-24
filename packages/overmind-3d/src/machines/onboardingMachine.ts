import { setup, assign } from 'xstate';

/**
 * Identifiant SÉMANTIQUE d'une étape du tuto. Un PARCOURS est un tableau ordonné de ces ids ;
 * le bridge raisonne par id (`switch (stepId)`) et non par index numérique → robuste aux deux
 * parcours (desktop / mobile) de longueurs différentes, sans constante d'index fragile à recaler
 * à chaque insertion d'étape (l'ancien piège `STEP_SCREEN = 3`).
 */
export type StepId =
  | 'welcome' // accueil : présentation seule, aucune action imposée — un scroll/swipe avance
  | 'navarc'  // NavArc / langue (inséré en PR D — le tableau est data-driven)
  | 'scroll'  // apprentissage scroll (desktop) / swipe (mobile)
  | 'look'    // free-look clic-glisser (desktop) / regarder autour gyroscope (mobile)
  | 'edge'    // bords d'écran (desktop only)
  | 'screen'  // écran holo — lecture (plate desktop / zoomée guidée mobile)
  | 'links'   // réseaux
  | 'cv'      // CV
  | 'end';    // fin (nav libre)

/**
 * Parcours DESKTOP. L'étape 'navarc' viendra s'insérer après 'welcome' en PR D (ajouter l'id
 * suffit). Le parcours mobile (divergent, gyroscope + lecture zoomée) arrivera avec le canal
 * tactile (PR C/F). Le choix du parcours selon le device se fera à ce moment-là.
 */
export const DESKTOP_STEPS: StepId[] = ['welcome', 'scroll', 'look', 'edge', 'screen', 'links', 'cv', 'end'];

export interface OnboardingContext {
  /** Parcours actif (choisi selon le device — desktop pour l'instant). */
  steps: StepId[];
  /** Index courant dans `steps`, 0 → steps.length - 1. */
  stepIdx: number;
}

export type OnboardingEvents =
  | { type: 'ARRIVE_B' } // arrivée en B via AB → démarre la présentation
  | { type: 'LEAVE_B' }  // quitte B (sécurité) → ferme
  | { type: 'NEXT' }     // scroll/swipe avant → étape suivante
  | { type: 'PREV' }     // scroll/swipe arrière → étape précédente
  | { type: 'CLOSE' };   // validation sur la dernière étape → fin (reste en B, nav libre)

/**
 * onboardingMachine — orchestration de la présentation guidée « Onboarding B ».
 *
 * Flow : `idle` --ARRIVE_B--> `presenting` (stepIdx 0..steps.length-1, NEXT/PREV) --CLOSE/LEAVE_B--> `idle`.
 * Le bridge (scene/onboardingBridge.ts) lit `steps[stepIdx]` (un StepId) et applique les effets par
 * étape (accroche Sentinelle, biais caméra, verrou nav, détour scroll/tactile, bulle, projecteur).
 */
export const onboardingMachine = setup({
  types: {} as {
    context: OnboardingContext;
    events: OnboardingEvents;
  },
}).createMachine({
  id: 'onboarding',
  initial: 'idle',
  context: { steps: DESKTOP_STEPS, stepIdx: 0 },
  states: {
    idle: {
      on: {
        ARRIVE_B: { target: 'presenting', actions: assign({ stepIdx: 0 }) },
      },
    },
    presenting: {
      on: {
        NEXT: {
          actions: assign({
            stepIdx: ({ context }) => Math.min(context.steps.length - 1, context.stepIdx + 1),
          }),
        },
        PREV: {
          actions: assign({
            stepIdx: ({ context }) => Math.max(0, context.stepIdx - 1),
          }),
        },
        CLOSE: { target: 'idle' },
        LEAVE_B: { target: 'idle' },
      },
    },
  },
});
