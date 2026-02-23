import { setup, assign } from 'xstate';
import * as THREE from 'three';

export type MaterialGroup = 'iris' | 'eyeRings' | 'revealRings';

export interface GroupConfig {
  materials: THREE.Material[] | null;
  emissiveColor: string;
  emissiveIntensity: number;
  visible: boolean;
  objects: THREE.Object3D[] | null;
}

export interface MaterialContext {
  groups: {
    iris: GroupConfig;
    eyeRings: GroupConfig;
    revealRings: GroupConfig;
  };
}

export type MaterialEvents =
  | { type: 'SET_GROUP_MATERIALS'; group: MaterialGroup; materials: THREE.Material[] }
  | { type: 'SET_REVEAL_OBJECTS'; objects: THREE.Object3D[] }
  | { type: 'UPDATE_GROUP_EMISSIVE_COLOR'; group: MaterialGroup; color: string }
  | { type: 'UPDATE_GROUP_EMISSIVE_INTENSITY'; group: MaterialGroup; intensity: number }
  | { type: 'SET_ALL_GROUPS_COLOR'; color: string }
  | { type: 'TOGGLE_REVEAL_VISIBILITY' }
  | { type: 'SHOW_REVEAL' }
  | { type: 'HIDE_REVEAL' }
  | { type: 'RESTORE_DEFAULTS' };

export const materialMachine = setup({
  types: {} as {
    context: MaterialContext;
    events: MaterialEvents;
  },
  actions: {
    applyGroupEmissiveColor: ({ context, event }) => {
      if (event.type === 'UPDATE_GROUP_EMISSIVE_COLOR') {
        const group = context.groups[event.group];
        if (group.materials) {
          const color = new THREE.Color(event.color);
          group.materials.forEach((material) => {
            if ('emissive' in material) {
              (material as THREE.MeshStandardMaterial).emissive.copy(color);
              material.needsUpdate = true;
            }
          });
        }
      }
    },
    applyGroupEmissiveIntensity: ({ context, event }) => {
      if (event.type === 'UPDATE_GROUP_EMISSIVE_INTENSITY') {
        const group = context.groups[event.group];
        if (group.materials) {
          group.materials.forEach((material) => {
            if ('emissiveIntensity' in material) {
              (material as THREE.MeshStandardMaterial).emissiveIntensity = event.intensity;
              material.needsUpdate = true;
            }
          });
        }
      }
    },
    applyColorToAllGroups: ({ context, event }) => {
      if (event.type === 'SET_ALL_GROUPS_COLOR') {
        const color = new THREE.Color(event.color);
        (['iris', 'eyeRings', 'revealRings'] as MaterialGroup[]).forEach((groupName) => {
          const group = context.groups[groupName];
          if (group.materials) {
            group.materials.forEach((material) => {
              if ('emissive' in material) {
                (material as THREE.MeshStandardMaterial).emissive.copy(color);
                material.needsUpdate = true;
              }
            });
          }
        });
      }
    },
    applyRevealVisibility: ({ context }) => {
      const revealGroup = context.groups.revealRings;
      if (revealGroup.objects) {
        revealGroup.objects.forEach((obj) => {
          obj.visible = revealGroup.visible;
          obj.traverse((child) => {
            child.visible = revealGroup.visible;
          });
        });
      }
    },
  },
}).createMachine({
  id: 'material',
  context: {
    groups: {
      iris: {
        materials: null,
        emissiveColor: '#00d0fa',
        emissiveIntensity: 1.2,
        visible: true,
        objects: null,
      },
      eyeRings: {
        materials: null,
        emissiveColor: '#00d0fa',
        emissiveIntensity: 2.0,
        visible: true,
        objects: null,
      },
      revealRings: {
        materials: null,
        emissiveColor: '#00d0fa',
        emissiveIntensity: 2.0,
        visible: false,
        objects: null,
      },
    },
  },
  on: {
    SET_GROUP_MATERIALS: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            ...context.groups,
            [event.group]: {
              ...context.groups[event.group],
              materials: event.materials,
            },
          }),
        }),
        ({ context, event }) => {
          const group = context.groups[event.group];
          if (group.materials) {
            const color = new THREE.Color(group.emissiveColor);
            group.materials.forEach((material) => {
              if ('emissive' in material && 'emissiveIntensity' in material) {
                const mat = material as THREE.MeshStandardMaterial;
                mat.emissive.copy(color);
                mat.emissiveIntensity = group.emissiveIntensity;
                material.needsUpdate = true;
              }
            });
          }
        },
      ],
    },
    SET_REVEAL_OBJECTS: {
      actions: assign({
        groups: ({ context, event }) => ({
          ...context.groups,
          revealRings: {
            ...context.groups.revealRings,
            objects: event.objects,
          },
        }),
      }),
    },
    UPDATE_GROUP_EMISSIVE_COLOR: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            ...context.groups,
            [event.group]: {
              ...context.groups[event.group],
              emissiveColor: event.color,
            },
          }),
        }),
        'applyGroupEmissiveColor',
      ],
    },
    UPDATE_GROUP_EMISSIVE_INTENSITY: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            ...context.groups,
            [event.group]: {
              ...context.groups[event.group],
              emissiveIntensity: event.intensity,
            },
          }),
        }),
        'applyGroupEmissiveIntensity',
      ],
    },
    SET_ALL_GROUPS_COLOR: {
      actions: [
        assign({
          groups: ({ context, event }) => ({
            iris: { ...context.groups.iris, emissiveColor: event.color },
            eyeRings: { ...context.groups.eyeRings, emissiveColor: event.color },
            revealRings: { ...context.groups.revealRings, emissiveColor: event.color },
          }),
        }),
        'applyColorToAllGroups',
      ],
    },
    TOGGLE_REVEAL_VISIBILITY: {
      actions: [
        assign({
          groups: ({ context }) => ({
            ...context.groups,
            revealRings: {
              ...context.groups.revealRings,
              visible: !context.groups.revealRings.visible,
            },
          }),
        }),
        'applyRevealVisibility',
      ],
    },
    SHOW_REVEAL: {
      actions: [
        assign({
          groups: ({ context }) => ({
            ...context.groups,
            revealRings: { ...context.groups.revealRings, visible: true },
          }),
        }),
        'applyRevealVisibility',
      ],
    },
    HIDE_REVEAL: {
      actions: [
        assign({
          groups: ({ context }) => ({
            ...context.groups,
            revealRings: { ...context.groups.revealRings, visible: false },
          }),
        }),
        'applyRevealVisibility',
      ],
    },
    RESTORE_DEFAULTS: {
      actions: assign({
        groups: {
          iris: { materials: null, emissiveColor: '#00d0fa', emissiveIntensity: 1.2, visible: true, objects: null },
          eyeRings: { materials: null, emissiveColor: '#00d0fa', emissiveIntensity: 2.0, visible: true, objects: null },
          revealRings: { materials: null, emissiveColor: '#00d0fa', emissiveIntensity: 2.0, visible: false, objects: null },
        },
      }),
    },
  },
});
