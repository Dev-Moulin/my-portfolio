import { setup, assign } from 'xstate';
import type { EasingType } from '../utils/easing.ts';

// Re-export for backward compatibility
export type { EasingType } from '../utils/easing.ts';

export interface CameraKeyframe {
  at: number;
  posX: number;
  posY: number;
  posZ: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  fov: number;
  easing: EasingType;
}

export interface CameraKeyframeContext {
  keyframes: CameraKeyframe[];
  scrollProgress: number;
  enabled: boolean;
}

export type CameraKeyframeEvents =
  | { type: 'UPDATE_SCROLL'; progress: number }
  | { type: 'ADD_KEYFRAME'; keyframe: CameraKeyframe }
  | { type: 'UPDATE_KEYFRAME'; index: number; keyframe: CameraKeyframe }
  | { type: 'DELETE_KEYFRAME'; index: number }
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'IMPORT_KEYFRAMES'; keyframes: CameraKeyframe[] }
  | { type: 'RESTORE_DEFAULTS' };

function sortKeyframes(kfs: CameraKeyframe[]): CameraKeyframe[] {
  return [...kfs].sort((a, b) => a.at - b.at);
}

const DEFAULTS: CameraKeyframeContext = {
  keyframes: [],
  scrollProgress: 0,
  enabled: false,
};

export const cameraKeyframeMachine = setup({
  types: {} as {
    context: CameraKeyframeContext;
    events: CameraKeyframeEvents;
  },
}).createMachine({
  id: 'cameraKeyframe',
  context: { ...DEFAULTS },
  on: {
    UPDATE_SCROLL: {
      actions: assign({
        scrollProgress: ({ event }) => Math.max(0, Math.min(1, event.progress)),
      }),
    },
    ADD_KEYFRAME: {
      actions: assign({
        keyframes: ({ context, event }) => sortKeyframes([...context.keyframes, event.keyframe]),
      }),
    },
    UPDATE_KEYFRAME: {
      actions: assign({
        keyframes: ({ context, event }) => {
          const updated = [...context.keyframes];
          if (event.index >= 0 && event.index < updated.length) {
            updated[event.index] = event.keyframe;
          }
          return sortKeyframes(updated);
        },
      }),
    },
    DELETE_KEYFRAME: {
      actions: assign({
        keyframes: ({ context, event }) =>
          context.keyframes.filter((_, i) => i !== event.index),
      }),
    },
    SET_ENABLED: {
      actions: assign({ enabled: ({ event }) => event.enabled }),
    },
    IMPORT_KEYFRAMES: {
      actions: assign({
        keyframes: ({ event }) => sortKeyframes(event.keyframes),
      }),
    },
    RESTORE_DEFAULTS: {
      actions: assign({ ...DEFAULTS }),
    },
  },
});
