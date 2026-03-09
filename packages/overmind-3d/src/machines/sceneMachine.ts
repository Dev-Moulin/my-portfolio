import { setup, assign } from 'xstate';
import * as THREE from 'three';
import { InfiniteGrid } from '../scene/infiniteGrid.ts';

export interface SceneContext {
  scene: THREE.Scene | null;
  backgroundColor: string;
  // Camera
  camera: THREE.PerspectiveCamera | null;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  fov: number;
  // Grid
  gridHelper: THREE.Object3D | null;
  gridVisible: boolean;
  gridSize: number;
  gridDivisions: number;
  gridColor1: string;
  gridColor2: string;
  axesHelper: THREE.AxesHelper | null;
  axesVisible: boolean;
  axesSize: number;
}

export type SceneEvents =
  | { type: 'SET_SCENE'; scene: THREE.Scene }
  | { type: 'SET_CAMERA'; camera: THREE.PerspectiveCamera }
  | { type: 'UPDATE_CAMERA_POSITION'; x: number; y: number; z: number }
  | { type: 'UPDATE_LOOK_AT'; x: number; y: number; z: number }
  | { type: 'UPDATE_FOV'; fov: number }
  | { type: 'SET_BACKGROUND_COLOR'; color: string }
  | { type: 'INITIALIZE_GRID'; gridHelper: THREE.Object3D }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SHOW_GRID' }
  | { type: 'HIDE_GRID' }
  | { type: 'UPDATE_GRID_SIZE'; size: number }
  | { type: 'UPDATE_GRID_DIVISIONS'; divisions: number }
  | { type: 'UPDATE_GRID_COLORS'; color1: string; color2: string }
  | { type: 'INITIALIZE_AXES'; axesHelper: THREE.AxesHelper }
  | { type: 'TOGGLE_AXES' }
  | { type: 'SHOW_AXES' }
  | { type: 'HIDE_AXES' }
  | { type: 'UPDATE_AXES_SIZE'; size: number }
  | { type: 'RESTORE_DEFAULTS' }
  | { type: 'RESTORE_CONTEXT'; context: { backgroundColor: string; cameraX: number; cameraY: number; cameraZ: number; lookAtX: number; lookAtY: number; lookAtZ: number; fov: number; gridVisible: boolean; gridSize: number; gridDivisions: number; gridColor1: string; gridColor2: string; axesVisible: boolean; axesSize: number } };

export const sceneMachine = setup({
  types: {} as {
    context: SceneContext;
    events: SceneEvents;
  },
  actions: {
    applyBackgroundColor: ({ context }) => {
      if (context.scene) {
        context.scene.background = new THREE.Color(context.backgroundColor);
      }
    },
    applyCameraPosition: ({ context }) => {
      if (context.camera) {
        context.camera.position.set(context.cameraX, context.cameraY, context.cameraZ);
        context.camera.lookAt(context.lookAtX, context.lookAtY, context.lookAtZ);
      }
    },
    applyCameraFov: ({ context }) => {
      if (context.camera) {
        context.camera.fov = context.fov;
        context.camera.updateProjectionMatrix();
      }
    },
    applyGridVisibility: ({ context }) => {
      if (context.gridHelper) {
        context.gridHelper.visible = context.gridVisible;
      }
    },
    recreateGridHelper: ({ context }) => {
      const grid = context.gridHelper;
      if (grid && grid instanceof InfiniteGrid) {
        grid.setGridSizes(context.gridSize, context.gridSize * context.gridDivisions);
        grid.setGridColor(context.gridColor2);
      }
    },
    applyAxesVisibility: ({ context }) => {
      if (context.axesHelper) {
        context.axesHelper.visible = context.axesVisible;
      }
    },
    recreateAxesHelper: ({ context }) => {
      if (context.scene && context.axesHelper) {
        context.scene.remove(context.axesHelper);
        context.axesHelper.dispose();
        const newAxes = new THREE.AxesHelper(context.axesSize);
        newAxes.visible = context.axesVisible;
        context.scene.add(newAxes);
        context.axesHelper = newAxes;
      }
    }
  }
}).createMachine({
  id: 'scene',
  context: {
    scene: null,
    backgroundColor: '#0a0a0a',
    camera: null,
    cameraX: 0,
    cameraY: 1.5,
    cameraZ: 12,
    lookAtX: 0,
    lookAtY: 1,
    lookAtZ: 0,
    fov: 45,
    gridHelper: null,
    gridVisible: false,
    gridSize: 10,
    gridDivisions: 10,
    gridColor1: '#888888',
    gridColor2: '#444444',
    axesHelper: null,
    axesVisible: false,
    axesSize: 5,
  },
  on: {
    SET_SCENE: {
      actions: [
        assign({ scene: ({ event }) => event.scene }),
        'applyBackgroundColor'
      ]
    },
    SET_CAMERA: {
      actions: assign({ camera: ({ event }) => event.camera }),
    },
    UPDATE_CAMERA_POSITION: {
      actions: [
        assign({
          cameraX: ({ event }) => event.x,
          cameraY: ({ event }) => event.y,
          cameraZ: ({ event }) => event.z,
        }),
        'applyCameraPosition',
      ],
    },
    UPDATE_LOOK_AT: {
      actions: [
        assign({
          lookAtX: ({ event }) => event.x,
          lookAtY: ({ event }) => event.y,
          lookAtZ: ({ event }) => event.z,
        }),
        'applyCameraPosition',
      ],
    },
    UPDATE_FOV: {
      actions: [
        assign({ fov: ({ event }) => event.fov }),
        'applyCameraFov',
      ],
    },
    SET_BACKGROUND_COLOR: {
      actions: [
        assign({ backgroundColor: ({ event }) => event.color }),
        'applyBackgroundColor'
      ]
    },
    INITIALIZE_GRID: {
      actions: assign({ gridHelper: ({ event }) => event.gridHelper })
    },
    TOGGLE_GRID: {
      actions: [
        assign({ gridVisible: ({ context }) => !context.gridVisible }),
        'applyGridVisibility'
      ]
    },
    SHOW_GRID: {
      actions: [assign({ gridVisible: true }), 'applyGridVisibility']
    },
    HIDE_GRID: {
      actions: [assign({ gridVisible: false }), 'applyGridVisibility']
    },
    UPDATE_GRID_SIZE: {
      actions: [
        assign({ gridSize: ({ event }) => event.size }),
        'recreateGridHelper'
      ]
    },
    UPDATE_GRID_DIVISIONS: {
      actions: [
        assign({ gridDivisions: ({ event }) => event.divisions }),
        'recreateGridHelper'
      ]
    },
    UPDATE_GRID_COLORS: {
      actions: [
        assign({
          gridColor1: ({ event }) => event.color1,
          gridColor2: ({ event }) => event.color2
        }),
        'recreateGridHelper'
      ]
    },
    INITIALIZE_AXES: {
      actions: assign({ axesHelper: ({ event }) => event.axesHelper })
    },
    TOGGLE_AXES: {
      actions: [
        assign({ axesVisible: ({ context }) => !context.axesVisible }),
        'applyAxesVisibility'
      ]
    },
    SHOW_AXES: {
      actions: [assign({ axesVisible: true }), 'applyAxesVisibility']
    },
    HIDE_AXES: {
      actions: [assign({ axesVisible: false }), 'applyAxesVisibility']
    },
    UPDATE_AXES_SIZE: {
      actions: [
        assign({ axesSize: ({ event }) => event.size }),
        'recreateAxesHelper'
      ]
    },
    RESTORE_DEFAULTS: {
      actions: [
        assign({
          backgroundColor: '#0a0a0a',
          cameraX: 0,
          cameraY: 1.5,
          cameraZ: 12,
          lookAtX: 0,
          lookAtY: 1,
          lookAtZ: 0,
          fov: 45,
          gridVisible: false,
          gridSize: 10,
          gridDivisions: 10,
          gridColor1: '#888888',
          gridColor2: '#444444',
          axesVisible: false,
          axesSize: 5,
        }),
        'applyBackgroundColor',
        'applyCameraPosition',
        'applyCameraFov',
        'applyGridVisibility',
        'applyAxesVisibility',
      ]
    },
    RESTORE_CONTEXT: {
      actions: [
        assign(({ event }) => event.context),
        'applyBackgroundColor',
        'applyCameraPosition',
        'applyCameraFov',
        'applyGridVisibility',
        'applyAxesVisibility',
      ]
    },
  }
});
