import { setup, assign, raise } from 'xstate';
import * as THREE from 'three';

export interface PopContext {
  scene: THREE.Scene | null;
  popSupObject: THREE.Object3D | null;
  popSupStartAngle: number;
  popSupTargetAngle: number;
  popSupCurrentAngle: number;
  popInfObject: THREE.Object3D | null;
  popInfStartAngle: number;
  popInfTargetAngle: number;
  popInfCurrentAngle: number;
  startPopSupAction: THREE.AnimationAction | null;
  startPopInfAction: THREE.AnimationAction | null;
  actionPopSupAction: THREE.AnimationAction | null;
  actionPopInfAction: THREE.AnimationAction | null;
  suspicionPopSupAction: THREE.AnimationAction | null;
  suspicionPopInfAction: THREE.AnimationAction | null;
  isAnimating: boolean;
  blinkSpeed: number;
  minBlinkInterval: number;
  maxBlinkInterval: number;
  nextBlinkTime: number | null;
  useActionAnimation: boolean;
  blinkStartTime: number | null;
  blinkPhase: 'closing' | 'opening' | null;
}

export type PopEvents =
  | { type: 'SET_SCENE'; scene: THREE.Scene }
  | { type: 'INITIALIZE_OBJECTS'; popSup: THREE.Object3D; popInf: THREE.Object3D }
  | {
      type: 'SET_ANIMATION_ACTIONS';
      startPopSupAction: THREE.AnimationAction;
      startPopInfAction: THREE.AnimationAction;
      actionPopSupAction: THREE.AnimationAction;
      actionPopInfAction: THREE.AnimationAction;
      suspicionPopSupAction: THREE.AnimationAction;
      suspicionPopInfAction: THREE.AnimationAction;
    }
  | { type: 'PLAY_START_ANIMATION' }
  | { type: 'SET_POP_SUP_START_ANGLE'; angle: number }
  | { type: 'SET_POP_SUP_TARGET_ANGLE'; angle: number }
  | { type: 'UPDATE_POP_SUP_ROTATION'; angle: number }
  | { type: 'SET_POP_INF_START_ANGLE'; angle: number }
  | { type: 'SET_POP_INF_TARGET_ANGLE'; angle: number }
  | { type: 'UPDATE_POP_INF_ROTATION'; angle: number }
  | { type: 'START_ANIMATION' }
  | { type: 'STOP_ANIMATION' }
  | { type: 'SET_BLINK_SPEED'; speed: number }
  | { type: 'SET_BLINK_INTERVAL'; min: number; max: number }
  | { type: 'TICK'; timestamp: number }
  | { type: 'APPLY_ROTATIONS' }
  | { type: 'BLINK_CLOSE_DONE' }
  | { type: 'BLINK_OPEN_DONE' }
  | { type: 'NOOP' };

export const popMachine = setup({
  types: {
    context: {} as PopContext,
    events: {} as PopEvents
  },
  actions: {
    playBlinkAnimation: ({ context }) => {
      const popSupAction = context.useActionAnimation
        ? context.actionPopSupAction
        : context.suspicionPopSupAction;
      const popInfAction = context.useActionAnimation
        ? context.actionPopInfAction
        : context.suspicionPopInfAction;
      if (popSupAction && popInfAction) {
        popSupAction.reset();
        popInfAction.reset();
        popSupAction.setLoop(THREE.LoopOnce, 1);
        popInfAction.setLoop(THREE.LoopOnce, 1);
        popSupAction.clampWhenFinished = true;
        popInfAction.clampWhenFinished = true;
        popSupAction.play();
        popInfAction.play();
      }
    },
    stopBlinkAnimation: ({ context }) => {
      const actions = [
        context.startPopSupAction, context.startPopInfAction,
        context.actionPopSupAction, context.actionPopInfAction,
        context.suspicionPopSupAction, context.suspicionPopInfAction
      ];
      actions.forEach(a => { if (a) { a.stop(); a.reset(); } });
    },
    applyPopSupRotation: ({ context }) => {
      if (context.popSupObject) {
        const radians = THREE.MathUtils.degToRad(context.popSupCurrentAngle);
        context.popSupObject.rotation.x = radians;
      }
    },
    applyPopInfRotation: ({ context }) => {
      if (context.popInfObject) {
        const radians = THREE.MathUtils.degToRad(context.popInfCurrentAngle) + Math.PI;
        context.popInfObject.rotation.x = radians;
      }
    },
    interpolateBlink: ({ context }) => {
      if (!context.blinkStartTime || !context.blinkPhase) return;
      const now = Date.now();
      const elapsed = now - context.blinkStartTime;
      const progress = Math.min(elapsed / context.blinkSpeed, 1.0);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      if (context.blinkPhase === 'closing') {
        context.popSupCurrentAngle = THREE.MathUtils.lerp(0, context.popSupTargetAngle, eased);
        context.popInfCurrentAngle = THREE.MathUtils.lerp(0, context.popInfTargetAngle, eased);
      } else {
        context.popSupCurrentAngle = THREE.MathUtils.lerp(context.popSupTargetAngle, 0, eased);
        context.popInfCurrentAngle = THREE.MathUtils.lerp(context.popInfTargetAngle, 0, eased);
      }
    },
    scheduleNextBlink: assign({
      nextBlinkTime: ({ context }) => {
        const interval = Math.random() * (context.maxBlinkInterval - context.minBlinkInterval) + context.minBlinkInterval;
        return Date.now() + interval;
      }
    }),
    clearNextBlink: assign({ nextBlinkTime: null }),
    resetToOpen: ({ context }) => {
      context.popSupCurrentAngle = 0;
      context.popInfCurrentAngle = 0;
    }
  },
  guards: {
    hasObjects: ({ context }) => context.popSupObject !== null && context.popInfObject !== null,
    shouldBlink: ({ context, event }) => {
      if (event.type !== 'TICK' || !context.nextBlinkTime) return false;
      return event.timestamp >= context.nextBlinkTime;
    }
  }
}).createMachine({
  id: 'popMachine',
  initial: 'idle',
  context: {
    scene: null,
    popSupObject: null,
    popSupStartAngle: 0,
    popSupTargetAngle: 45.5,
    popSupCurrentAngle: 0,
    popInfObject: null,
    popInfStartAngle: 0,
    popInfTargetAngle: -43,
    popInfCurrentAngle: 0,
    startPopSupAction: null,
    startPopInfAction: null,
    actionPopSupAction: null,
    actionPopInfAction: null,
    suspicionPopSupAction: null,
    suspicionPopInfAction: null,
    isAnimating: false,
    blinkSpeed: 150,
    minBlinkInterval: 2000,
    maxBlinkInterval: 7000,
    nextBlinkTime: null,
    useActionAnimation: true,
    blinkStartTime: null,
    blinkPhase: null
  },
  on: {
    SET_SCENE: {
      actions: ({ context, event }) => { context.scene = event.scene; }
    },
    INITIALIZE_OBJECTS: {
      actions: ({ context, event }) => {
        context.popSupObject = event.popSup;
        context.popInfObject = event.popInf;
      }
    },
    SET_ANIMATION_ACTIONS: {
      actions: ({ context, event }) => {
        context.startPopSupAction = event.startPopSupAction;
        context.startPopInfAction = event.startPopInfAction;
        context.actionPopSupAction = event.actionPopSupAction;
        context.actionPopInfAction = event.actionPopInfAction;
        context.suspicionPopSupAction = event.suspicionPopSupAction;
        context.suspicionPopInfAction = event.suspicionPopInfAction;
      }
    },
    PLAY_START_ANIMATION: {
      actions: ({ context }) => {
        if (context.startPopSupAction && context.startPopInfAction) {
          context.startPopSupAction.reset();
          context.startPopInfAction.reset();
          context.startPopSupAction.setLoop(THREE.LoopOnce, 1);
          context.startPopInfAction.setLoop(THREE.LoopOnce, 1);
          context.startPopSupAction.clampWhenFinished = false;
          context.startPopInfAction.clampWhenFinished = false;
          context.startPopSupAction.play();
          context.startPopInfAction.play();
        }
      }
    },
    APPLY_ROTATIONS: [
      {
        guard: 'hasObjects',
        actions: ['interpolateBlink', 'applyPopSupRotation', 'applyPopInfRotation']
      },
      { actions: () => {} }
    ],
    SET_POP_SUP_START_ANGLE: {
      actions: assign({ popSupStartAngle: ({ event }) => event.angle })
    },
    SET_POP_SUP_TARGET_ANGLE: {
      actions: assign({ popSupTargetAngle: ({ event }) => event.angle })
    },
    SET_POP_INF_START_ANGLE: {
      actions: assign({ popInfStartAngle: ({ event }) => event.angle })
    },
    SET_POP_INF_TARGET_ANGLE: {
      actions: assign({ popInfTargetAngle: ({ event }) => event.angle })
    },
    START_ANIMATION: { target: '.animating' },
    STOP_ANIMATION: { target: '.idle' },
    SET_BLINK_SPEED: {
      actions: assign({ blinkSpeed: ({ event }) => event.speed })
    },
    SET_BLINK_INTERVAL: {
      actions: assign({
        minBlinkInterval: ({ event }) => event.min,
        maxBlinkInterval: ({ event }) => event.max
      })
    }
  },
  states: {
    idle: {
      entry: [assign({ isAnimating: false }), 'resetToOpen'],
      on: {
        START_ANIMATION: 'animating',
        UPDATE_POP_SUP_ROTATION: {
          actions: [
            ({ context, event }) => { context.popSupCurrentAngle = event.angle; },
            'applyPopSupRotation'
          ]
        },
        UPDATE_POP_INF_ROTATION: {
          actions: [
            ({ context, event }) => { context.popInfCurrentAngle = event.angle; },
            'applyPopInfRotation'
          ]
        }
      }
    },
    animating: {
      entry: [assign({ isAnimating: true }), 'scheduleNextBlink'],
      initial: 'waiting',
      on: { STOP_ANIMATION: 'idle' },
      states: {
        waiting: {
          on: {
            TICK: {
              guard: 'shouldBlink',
              target: 'closing'
            }
          }
        },
        closing: {
          entry: [
            'clearNextBlink',
            'playBlinkAnimation',
            assign({
              blinkStartTime: Date.now(),
              blinkPhase: 'closing' as const
            })
          ],
          on: {
            APPLY_ROTATIONS: {
              actions: [
                raise(({ context }) => {
                  if (!context.blinkStartTime) return { type: 'NOOP' as const };
                  const popSupAction = context.useActionAnimation
                    ? context.actionPopSupAction
                    : context.suspicionPopSupAction;
                  if (popSupAction && !popSupAction.isRunning()) {
                    return { type: 'BLINK_CLOSE_DONE' as const };
                  }
                  return { type: 'NOOP' as const };
                })
              ]
            },
            BLINK_CLOSE_DONE: { target: 'opening' }
          }
        },
        opening: {
          entry: [
            'stopBlinkAnimation',
            assign({
              blinkStartTime: Date.now(),
              blinkPhase: 'opening' as const
            }),
            'scheduleNextBlink'
          ],
          on: {
            APPLY_ROTATIONS: {
              actions: [
                raise(({ context }) => {
                  if (!context.blinkStartTime) return { type: 'NOOP' as const };
                  const elapsed = Date.now() - context.blinkStartTime;
                  if (elapsed >= context.blinkSpeed) return { type: 'BLINK_OPEN_DONE' as const };
                  return { type: 'NOOP' as const };
                })
              ]
            },
            BLINK_OPEN_DONE: {
              target: 'waiting',
              actions: assign({
                blinkPhase: null,
                blinkStartTime: null,
                useActionAnimation: ({ context }) => !context.useActionAnimation
              })
            }
          }
        }
      }
    }
  }
});
