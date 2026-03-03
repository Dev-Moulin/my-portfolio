import { setup, assign } from 'xstate';

export interface SelectionContext {
  selectedId: string | null;
  selectedIds: string[];
  mode: 'translate' | 'rotate' | 'scale';
  isTransforming: boolean;
  registeredIds: string[];
  visibility: Record<string, boolean>;
  locked: Record<string, boolean>;
  /** @deprecated Use interactionModeMachine instead */
  curveEditMode: boolean;
}

export type SelectionEvents =
  | { type: 'SELECT'; id: string }
  | { type: 'TOGGLE_SELECT'; id: string }
  | { type: 'SET_SELECTED_IDS'; ids: string[] }
  | { type: 'DESELECT' }
  | { type: 'SET_MODE'; mode: 'translate' | 'rotate' | 'scale' }
  | { type: 'SET_TRANSFORMING'; value: boolean }
  | { type: 'REGISTER_ID'; id: string }
  | { type: 'UNREGISTER_ID'; id: string }
  | { type: 'SET_VISIBILITY'; id: string; visible: boolean }
  | { type: 'TOGGLE_VISIBILITY'; id: string }
  | { type: 'SHOW_ALL' }
  | { type: 'TOGGLE_LOCKED'; id: string }
  | { type: 'SET_LOCKED'; id: string; locked: boolean }
  | { type: 'RESTORE_CONTEXT'; context: { selectedId: string | null; selectedIds?: string[]; mode: 'translate' | 'rotate' | 'scale' } }
  | { type: 'SET_CURVE_EDIT'; active: boolean };

export const selectionMachine = setup({
  types: {} as {
    context: SelectionContext;
    events: SelectionEvents;
  },
}).createMachine({
  id: 'selection',
  context: {
    selectedId: null,
    selectedIds: [],
    mode: 'translate',
    isTransforming: false,
    registeredIds: [],
    visibility: {},
    locked: {},
    curveEditMode: false,
  },
  on: {
    SELECT: {
      guard: ({ context, event }) => context.visibility[event.id] !== false && context.locked[event.id] !== true,
      actions: assign({
        selectedId: ({ event }) => event.id,
        selectedIds: ({ event }) => [event.id],
      }),
    },
    TOGGLE_SELECT: {
      guard: ({ context, event }) => context.visibility[event.id] !== false && context.locked[event.id] !== true,
      actions: assign({
        selectedIds: ({ context, event }) => {
          return context.selectedIds.includes(event.id)
            ? context.selectedIds.filter(id => id !== event.id)
            : [...context.selectedIds, event.id];
        },
        selectedId: ({ context, event }) => {
          const ids = context.selectedIds.includes(event.id)
            ? context.selectedIds.filter(id => id !== event.id)
            : [...context.selectedIds, event.id];
          return ids.length > 0 ? ids[ids.length - 1] : null;
        },
      }),
    },
    SET_SELECTED_IDS: {
      actions: assign({
        selectedIds: ({ event }) => event.ids,
        selectedId: ({ event }) => event.ids.length > 0 ? event.ids[event.ids.length - 1] : null,
      }),
    },
    DESELECT: {
      actions: assign({ selectedId: null, selectedIds: [] as string[], isTransforming: false }),
    },
    SET_MODE: {
      actions: assign({ mode: ({ event }) => event.mode }),
    },
    SET_TRANSFORMING: {
      actions: assign({ isTransforming: ({ event }) => event.value }),
    },
    REGISTER_ID: {
      actions: assign({
        registeredIds: ({ context, event }) =>
          context.registeredIds.includes(event.id)
            ? context.registeredIds
            : [...context.registeredIds, event.id],
        visibility: ({ context, event }) => ({
          ...context.visibility,
          [event.id]: context.visibility[event.id] ?? true,
        }),
      }),
    },
    UNREGISTER_ID: {
      actions: assign({
        registeredIds: ({ context, event }) =>
          context.registeredIds.filter(id => id !== event.id),
        visibility: ({ context, event }) => {
          const { [event.id]: _, ...rest } = context.visibility;
          return rest;
        },
        locked: ({ context, event }) => {
          const { [event.id]: _, ...rest } = context.locked;
          return rest;
        },
      }),
    },
    SET_VISIBILITY: {
      actions: assign({
        visibility: ({ context, event }) => ({
          ...context.visibility,
          [event.id]: event.visible,
        }),
        selectedId: ({ context, event }) =>
          !event.visible && context.selectedId === event.id
            ? null
            : context.selectedId,
        selectedIds: ({ context, event }) =>
          !event.visible
            ? context.selectedIds.filter(id => id !== event.id)
            : context.selectedIds,
      }),
    },
    TOGGLE_VISIBILITY: {
      actions: assign({
        visibility: ({ context, event }) => ({
          ...context.visibility,
          [event.id]: !(context.visibility[event.id] ?? true),
        }),
        selectedId: ({ context, event }) => {
          const wasVisible = context.visibility[event.id] ?? true;
          return wasVisible && context.selectedId === event.id
            ? null
            : context.selectedId;
        },
        selectedIds: ({ context, event }) => {
          const wasVisible = context.visibility[event.id] ?? true;
          return wasVisible
            ? context.selectedIds.filter(id => id !== event.id)
            : context.selectedIds;
        },
      }),
    },
    SHOW_ALL: {
      actions: assign({
        visibility: ({ context }) => {
          const v: Record<string, boolean> = {};
          for (const id of Object.keys(context.visibility)) {
            v[id] = true;
          }
          return v;
        },
      }),
    },
    TOGGLE_LOCKED: {
      actions: assign({
        locked: ({ context, event }) => ({
          ...context.locked,
          [event.id]: !(context.locked[event.id] ?? false),
        }),
        selectedId: ({ context, event }) => {
          const wasUnlocked = !(context.locked[event.id] ?? false);
          return !wasUnlocked ? context.selectedId
            : context.selectedId === event.id ? null : context.selectedId;
        },
        selectedIds: ({ context, event }) => {
          const wasUnlocked = !(context.locked[event.id] ?? false);
          return !wasUnlocked ? context.selectedIds
            : context.selectedIds.filter(id => id !== event.id);
        },
      }),
    },
    SET_LOCKED: {
      actions: assign({
        locked: ({ context, event }) => ({
          ...context.locked,
          [event.id]: event.locked,
        }),
        selectedId: ({ context, event }) =>
          event.locked && context.selectedId === event.id
            ? null : context.selectedId,
        selectedIds: ({ context, event }) =>
          event.locked
            ? context.selectedIds.filter(id => id !== event.id)
            : context.selectedIds,
      }),
    },
    SET_CURVE_EDIT: {
      actions: assign({ curveEditMode: ({ event }) => event.active }),
    },
    RESTORE_CONTEXT: {
      actions: assign(({ event }) => ({
        selectedId: event.context.selectedId,
        selectedIds: event.context.selectedIds ?? (event.context.selectedId ? [event.context.selectedId] : []),
        mode: event.context.mode,
      })),
    },
  },
});
