import { setup, assign } from 'xstate';

export interface ScrollCardContext {
  enabled: boolean;
  posTop: number;   // % from top
  posLeft: number;  // % from left
  scrollProgress: number;
}

export type ScrollCardEvents =
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'SET_POS_TOP'; value: number }
  | { type: 'SET_POS_LEFT'; value: number }
  | { type: 'UPDATE_SCROLL'; progress: number }
  | { type: 'RESTORE_DEFAULTS' };

const DEFAULTS: ScrollCardContext = {
  enabled: false,
  posTop: 26.7,
  posLeft: 83.6,
  scrollProgress: 0,
};

export const scrollCardMachine = setup({
  types: {} as {
    context: ScrollCardContext;
    events: ScrollCardEvents;
  },
}).createMachine({
  id: 'scrollCard',
  context: { ...DEFAULTS },
  on: {
    SET_ENABLED: {
      actions: assign({ enabled: ({ event }) => event.enabled }),
    },
    SET_POS_TOP: {
      actions: assign({ posTop: ({ event }) => event.value }),
    },
    SET_POS_LEFT: {
      actions: assign({ posLeft: ({ event }) => event.value }),
    },
    UPDATE_SCROLL: {
      actions: assign({
        scrollProgress: ({ event }) => Math.max(0, Math.min(1, event.progress)),
      }),
    },
    RESTORE_DEFAULTS: {
      actions: assign({ ...DEFAULTS }),
    },
  },
});
