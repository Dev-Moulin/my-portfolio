import { setup, assign } from 'xstate';
import type { ModelSettings } from '../scene/types.ts';

export type ModelEvents =
  | { type: 'SET_POSITION'; x: number; y: number; z: number }
  | { type: 'SET_SCALE'; scale: number }
  | { type: 'SET_BASE_ROTATION_Y'; value: number }
  | { type: 'SET_MOUSE_SENSITIVITY'; value: number }
  | { type: 'SET_MOUSE_RETURN_SPEED'; value: number }
  | { type: 'SET_MOUSE_DEAD_ZONE'; value: number }
  | { type: 'SET_MOUSE_MAX_ROT_Y'; value: number }
  | { type: 'SET_MOUSE_MAX_ROT_X'; value: number }
  | { type: 'SET_MOUSE_INACTIVE_MS'; value: number }
  | { type: 'RESET' }
  | { type: 'RESTORE_CONTEXT'; context: ModelSettings };

const DEFAULT: ModelSettings = {
  positionX: 0,
  positionY: 1.0,
  positionZ: 0,
  scale: 1,
  baseRotationY: 0,
  mouseSensitivity: 0.05,
  mouseReturnSpeed: 0.04,
  mouseDeadZone: 0.1,
  mouseMaxRotY: Math.PI / 3,
  mouseMaxRotX: Math.PI / 6,
  mouseInactiveMs: 3000,
};

export const modelMachine = setup({
  types: {} as {
    context: ModelSettings;
    events: ModelEvents;
  },
}).createMachine({
  id: 'model',
  initial: 'active',
  context: { ...DEFAULT },
  states: {
    active: {
      on: {
        SET_POSITION: {
          actions: assign({
            positionX: ({ event }) => event.x,
            positionY: ({ event }) => event.y,
            positionZ: ({ event }) => event.z,
          }),
        },
        SET_SCALE: {
          actions: assign({ scale: ({ event }) => event.scale }),
        },
        SET_BASE_ROTATION_Y: {
          actions: assign({ baseRotationY: ({ event }) => event.value }),
        },
        SET_MOUSE_SENSITIVITY: {
          actions: assign({ mouseSensitivity: ({ event }) => event.value }),
        },
        SET_MOUSE_RETURN_SPEED: {
          actions: assign({ mouseReturnSpeed: ({ event }) => event.value }),
        },
        SET_MOUSE_DEAD_ZONE: {
          actions: assign({ mouseDeadZone: ({ event }) => event.value }),
        },
        SET_MOUSE_MAX_ROT_Y: {
          actions: assign({ mouseMaxRotY: ({ event }) => event.value }),
        },
        SET_MOUSE_MAX_ROT_X: {
          actions: assign({ mouseMaxRotX: ({ event }) => event.value }),
        },
        SET_MOUSE_INACTIVE_MS: {
          actions: assign({ mouseInactiveMs: ({ event }) => event.value }),
        },
        RESTORE_CONTEXT: {
          actions: assign(({ event }) => event.context),
        },
        RESET: {
          actions: assign(DEFAULT),
        },
      },
    },
  },
});
