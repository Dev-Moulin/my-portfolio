import { setup, assign } from 'xstate';

export interface SelectionContext {
  selectedId: string | null;
  selectedIds: string[];
  mode: 'translate' | 'rotate' | 'scale';
  isTransforming: boolean;
  registeredIds: string[];
  visibility: Record<string, boolean>;
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
  | { type: 'RESTORE_CONTEXT'; context: { selectedId: string | null; selectedIds?: string[]; mode: 'translate' | 'rotate' | 'scale' } };

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
  },
  on: {
    SELECT: {
      guard: ({ context, event }) => context.visibility[event.id] !== false,
      actions: assign({
        selectedId: ({ event }) => event.id,
        selectedIds: ({ event }) => [event.id],
      }),
    },
    TOGGLE_SELECT: {
      guard: ({ context, event }) => context.visibility[event.id] !== false,
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
    RESTORE_CONTEXT: {
      actions: assign(({ event }) => ({
        selectedId: event.context.selectedId,
        selectedIds: event.context.selectedIds ?? (event.context.selectedId ? [event.context.selectedId] : []),
        mode: event.context.mode,
      })),
    },
  },
});
