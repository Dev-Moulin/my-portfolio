import { setup, assign } from 'xstate';
import type * as THREE from 'three';

export interface PerformanceContext {
  renderer: THREE.WebGLRenderer | null;
  fps: number;
  fpsHistory: number[];
  maxFpsHistory: number;
  memoryUsed: number;
  memoryLimit: number;
  memoryUsedPercent: number;
  rendererInfo: {
    triangles: number;
    geometries: number;
    textures: number;
    programs: number;
    calls: number;
  };
  isMonitoring: boolean;
}

export type PerformanceEvents =
  | { type: 'SET_RENDERER'; renderer: THREE.WebGLRenderer }
  | { type: 'START_MONITORING' }
  | { type: 'STOP_MONITORING' }
  | { type: 'UPDATE_FPS'; fps: number }
  | { type: 'UPDATE_MEMORY'; used: number; limit: number }
  | { type: 'UPDATE_RENDERER_INFO'; info: PerformanceContext['rendererInfo'] }
  | { type: 'CLEAR_HISTORY' };

export const performanceMonitor = setup({
  types: {} as {
    context: PerformanceContext;
    events: PerformanceEvents;
  },
  actions: {
    addFpsToHistory: assign({
      fpsHistory: ({ context, event }) => {
        if (event.type === 'UPDATE_FPS') {
          const newHistory = [...context.fpsHistory, event.fps];
          if (newHistory.length > context.maxFpsHistory) {
            return newHistory.slice(-context.maxFpsHistory);
          }
          return newHistory;
        }
        return context.fpsHistory;
      }
    }),
    calculateMemoryPercent: assign({
      memoryUsedPercent: ({ context }) => {
        if (context.memoryLimit === 0) return 0;
        return Math.round((context.memoryUsed / context.memoryLimit) * 100);
      }
    })
  }
}).createMachine({
  id: 'performance',
  initial: 'stopped',
  context: {
    renderer: null,
    fps: 0,
    fpsHistory: [],
    maxFpsHistory: 60,
    memoryUsed: 0,
    memoryLimit: 0,
    memoryUsedPercent: 0,
    rendererInfo: {
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      calls: 0
    },
    isMonitoring: false
  },
  states: {
    stopped: {
      on: {
        SET_RENDERER: {
          actions: assign({ renderer: ({ event }) => event.renderer })
        },
        START_MONITORING: {
          target: 'monitoring',
          actions: assign({ isMonitoring: true })
        }
      }
    },
    monitoring: {
      on: {
        STOP_MONITORING: {
          target: 'stopped',
          actions: assign({ isMonitoring: false })
        },
        UPDATE_FPS: {
          actions: [
            assign({ fps: ({ event }) => event.fps }),
            'addFpsToHistory'
          ]
        },
        UPDATE_MEMORY: {
          actions: [
            assign({
              memoryUsed: ({ event }) => event.used,
              memoryLimit: ({ event }) => event.limit
            }),
            'calculateMemoryPercent'
          ]
        },
        UPDATE_RENDERER_INFO: {
          actions: assign({ rendererInfo: ({ event }) => event.info })
        },
        CLEAR_HISTORY: {
          actions: assign({ fpsHistory: [] })
        }
      }
    }
  }
});
