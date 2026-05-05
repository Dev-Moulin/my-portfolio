import { setup, assign } from 'xstate';

// ── Types ──────────────────────────────────────────────────────────────────

export type InteractionMode = 'object' | 'edit' | 'preview';
export type EditTargetType = 'curve' | 'text' | 'card' | null;

export interface InteractionModeContext {
  mode: InteractionMode;
  previousMode: InteractionMode;
  editTargetType: EditTargetType;
  editTargetId: string | null;
}

export type InteractionModeEvents =
  | { type: 'ENTER_OBJECT_MODE' }
  | { type: 'ENTER_EDIT_MODE'; targetType: EditTargetType; targetId?: string }
  | { type: 'ENTER_PREVIEW_MODE' }
  | { type: 'TOGGLE_OBJECT_EDIT' }
  | { type: 'SET_EDIT_TARGET'; targetType: EditTargetType; targetId?: string };

// ── Machine ────────────────────────────────────────────────────────────────

export const interactionModeMachine = setup({
  types: {} as {
    context: InteractionModeContext;
    events: InteractionModeEvents;
  },
}).createMachine({
  id: 'interactionMode',
  initial: 'object',
  context: {
    mode: 'object' as InteractionMode,
    previousMode: 'object' as InteractionMode,
    editTargetType: null,
    editTargetId: null,
  },
  states: {
    object: {
      entry: assign({
        mode: 'object' as InteractionMode,
        editTargetType: null,
        editTargetId: null,
      }),
      on: {
        ENTER_EDIT_MODE: {
          target: 'edit',
          actions: assign(({ context, event }) => ({
            previousMode: context.mode,
            editTargetType: event.targetType,
            editTargetId: event.targetId ?? null,
          })),
        },
        TOGGLE_OBJECT_EDIT: { target: 'edit' },
        ENTER_PREVIEW_MODE: { target: 'preview' },
      },
    },
    edit: {
      entry: assign({ mode: 'edit' as InteractionMode }),
      on: {
        ENTER_OBJECT_MODE: {
          target: 'object',
          actions: assign({ previousMode: 'edit' as InteractionMode }),
        },
        TOGGLE_OBJECT_EDIT: { target: 'object' },
        SET_EDIT_TARGET: {
          actions: assign(({ event }) => ({
            editTargetType: event.targetType,
            editTargetId: event.targetId ?? null,
          })),
        },
        ENTER_PREVIEW_MODE: { target: 'preview' },
      },
    },
    preview: {
      entry: assign({ mode: 'preview' as InteractionMode }),
      on: {
        ENTER_OBJECT_MODE: {
          target: 'object',
          actions: assign({ previousMode: 'preview' as InteractionMode }),
        },
        ENTER_EDIT_MODE: {
          target: 'edit',
          actions: assign(({ event }) => ({
            previousMode: 'preview' as InteractionMode,
            editTargetType: event.targetType,
            editTargetId: event.targetId ?? null,
          })),
        },
      },
    },
  },
});
