import { setup, assign } from 'xstate';

/** Nombre d'étapes de la présentation guidée à l'arrivée en B (textes `onboarding.b.step1..7`).
 *  7 étapes : 0 scroll · 1 free-look · 2 bords d'écran · 3 écran holo · 4 réseaux · 5 CV · 6 fin. */
export const ONBOARDING_TOTAL_STEPS = 7;

export interface OnboardingContext {
  /** Étape courante, 0 → ONBOARDING_TOTAL_STEPS-1. */
  stepIdx: number;
}

export type OnboardingEvents =
  | { type: 'ARRIVE_B' } // arrivée en B via AB → démarre la présentation
  | { type: 'LEAVE_B' }  // quitte B (sécurité) → ferme
  | { type: 'NEXT' }     // scroll avant → étape suivante
  | { type: 'PREV' }     // scroll arrière → étape précédente
  | { type: 'CLOSE' };   // scroll appuyé sur la dernière étape → fin (reste en B, nav libre)

/**
 * onboardingMachine — orchestration de la présentation guidée « Onboarding B ».
 *
 * Flow : `idle` --ARRIVE_B--> `presenting` (stepIdx 0..6, NEXT/PREV) --CLOSE/LEAVE_B--> `idle`.
 * Le bridge (scene/onboardingBridge.ts) applique les effets selon l'état (accroche Sentinelle,
 * biais caméra, verrou nav, détour scroll, bulle, projecteur) et relaie les events.
 */
export const onboardingMachine = setup({
  types: {} as {
    context: OnboardingContext;
    events: OnboardingEvents;
  },
}).createMachine({
  id: 'onboarding',
  initial: 'idle',
  context: { stepIdx: 0 },
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
            stepIdx: ({ context }) => Math.min(ONBOARDING_TOTAL_STEPS - 1, context.stepIdx + 1),
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
