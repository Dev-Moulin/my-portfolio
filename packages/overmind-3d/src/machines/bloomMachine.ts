import { setup, assign, sendTo } from 'xstate';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface BloomContext {
  bloomPass: UnrealBloomPass | null;
  threshold: number;
  strength: number;
  radius: number;
  enabled: boolean;
  bloomColor: string;
}

export type BloomEvents =
  | { type: 'SET_BLOOM_PASS'; bloomPass: UnrealBloomPass }
  | { type: 'ENABLE' }
  | { type: 'DISABLE' }
  | { type: 'TOGGLE' }
  | { type: 'SET_THRESHOLD'; threshold: number }
  | { type: 'SET_STRENGTH'; strength: number }
  | { type: 'SET_RADIUS'; radius: number }
  | { type: 'SET_BLOOM_COLOR'; color: string }
  | { type: 'RESTORE_DEFAULTS' }
  | { type: 'RESTORE_CONTEXT'; context: { threshold: number; strength: number; radius: number; enabled: boolean; bloomColor: string } };

export const bloomMachine = setup({
  types: {} as {
    context: BloomContext;
    events: BloomEvents;
  },
  actions: {
    applyThreshold: ({ context }) => {
      if (context.bloomPass && context.enabled) {
        context.bloomPass.threshold = context.threshold;
      }
    },
    applyStrength: ({ context }) => {
      if (context.bloomPass && context.enabled) {
        context.bloomPass.strength = context.strength;
      }
    },
    applyRadius: ({ context }) => {
      if (context.bloomPass && context.enabled) {
        context.bloomPass.radius = context.radius;
      }
    },
    applyEnabled: ({ context }) => {
      if (context.bloomPass) {
        context.bloomPass.enabled = context.enabled;
      }
    },
    notifyMaterialColorChange: sendTo(
      ({ system }) => system.get('material'),
      ({ event }) => ({
        type: 'SET_ALL_GROUPS_COLOR' as const,
        color: event.type === 'SET_BLOOM_COLOR' ? event.color : '#00d0fa',
      }),
    ),
  },
}).createMachine({
  id: 'bloom',
  context: {
    bloomPass: null,
    threshold: 0.5,
    strength: 0.6,
    radius: 1,
    enabled: true,
    bloomColor: '#00d0fa',
  },
  on: {
    SET_BLOOM_PASS: {
      actions: [
        assign({ bloomPass: ({ event }) => event.bloomPass }),
        'applyThreshold',
        'applyStrength',
        'applyRadius',
        'applyEnabled',
      ],
    },
    ENABLE: {
      actions: [assign({ enabled: true }), 'applyEnabled'],
    },
    DISABLE: {
      actions: [assign({ enabled: false }), 'applyEnabled'],
    },
    TOGGLE: {
      actions: [
        assign({ enabled: ({ context }) => !context.enabled }),
        'applyEnabled',
      ],
    },
    SET_THRESHOLD: {
      actions: [
        assign({ threshold: ({ event }) => event.threshold }),
        'applyThreshold',
      ],
    },
    SET_STRENGTH: {
      actions: [
        assign({ strength: ({ event }) => event.strength }),
        'applyStrength',
      ],
    },
    SET_RADIUS: {
      actions: [
        assign({ radius: ({ event }) => event.radius }),
        'applyRadius',
      ],
    },
    SET_BLOOM_COLOR: {
      actions: [
        assign({ bloomColor: ({ event }) => event.color }),
        'notifyMaterialColorChange',
      ],
    },
    RESTORE_CONTEXT: {
      actions: [
        assign(({ event }) => event.context),
        'applyThreshold',
        'applyStrength',
        'applyRadius',
        'applyEnabled',
      ],
    },
    RESTORE_DEFAULTS: {
      actions: [
        assign({
          threshold: 0.5,
          strength: 0.6,
          radius: 1,
          bloomColor: '#00d0fa',
        }),
        'applyThreshold',
        'applyStrength',
        'applyRadius',
        'notifyMaterialColorChange',
      ],
    },
  },
});
