import { setup, assign } from 'xstate';
import type { ActorRefFrom } from 'xstate';
import { bloomMachine } from './bloomMachine.ts';
import { lightingMachine } from './lightingMachine.ts';
import { materialMachine } from './materialMachine.ts';
import { modelMachine } from './modelMachine.ts';
import { pbrMachine } from './pbrMachine.ts';
import { sceneMachine } from './sceneMachine.ts';
import { performanceMonitor } from './performanceMachine.ts';
import { revelationMachine } from './revelationMachine.ts';
import { popMachine } from './popMachine.ts';
import { visualPresetMachine } from './visualPresetMachine.ts';
import { neonBandsMachine } from './neonBandsMachine.ts';
import { steeringMachine } from './steeringMachine.ts';

export interface ApplicationContext {
  bloomActor: ActorRefFrom<typeof bloomMachine> | null;
  lightingActor: ActorRefFrom<typeof lightingMachine> | null;
  materialActor: ActorRefFrom<typeof materialMachine> | null;
  modelActor: ActorRefFrom<typeof modelMachine> | null;
  pbrActor: ActorRefFrom<typeof pbrMachine> | null;
  sceneActor: ActorRefFrom<typeof sceneMachine> | null;
  performanceActor: ActorRefFrom<typeof performanceMonitor> | null;
  revelationActor: ActorRefFrom<typeof revelationMachine> | null;
  popActor: ActorRefFrom<typeof popMachine> | null;
  visualPresetActor: ActorRefFrom<typeof visualPresetMachine> | null;
  neonBandsActor: ActorRefFrom<typeof neonBandsMachine> | null;
  steeringActor: ActorRefFrom<typeof steeringMachine> | null;
}

export type ApplicationEvents =
  | { type: 'INITIALIZE' }
  | { type: 'SHUTDOWN' };

export const applicationMachine = setup({
  types: {} as {
    context: ApplicationContext;
    events: ApplicationEvents;
  },
  actors: {
    bloom: bloomMachine,
    lighting: lightingMachine,
    material: materialMachine,
    model: modelMachine,
    pbr: pbrMachine,
    scene: sceneMachine,
    performance: performanceMonitor,
    revelation: revelationMachine,
    pop: popMachine,
    visualPreset: visualPresetMachine,
    neonBands: neonBandsMachine,
    steering: steeringMachine,
  },
}).createMachine({
  id: 'application',
  initial: 'running',
  context: {
    bloomActor: null,
    lightingActor: null,
    materialActor: null,
    modelActor: null,
    pbrActor: null,
    sceneActor: null,
    performanceActor: null,
    revelationActor: null,
    popActor: null,
    visualPresetActor: null,
    neonBandsActor: null,
    steeringActor: null,
  },
  states: {
    running: {
      entry: assign({
        bloomActor: ({ spawn }) => spawn('bloom', { systemId: 'bloom' }),
        lightingActor: ({ spawn }) => spawn('lighting', { systemId: 'lighting' }),
        materialActor: ({ spawn }) => spawn('material', { systemId: 'material' }),
        modelActor: ({ spawn }) => spawn('model', { systemId: 'model' }),
        pbrActor: ({ spawn }) => spawn('pbr', { systemId: 'pbr' }),
        sceneActor: ({ spawn }) => spawn('scene', { systemId: 'scene' }),
        performanceActor: ({ spawn }) => spawn('performance', { systemId: 'performance' }),
        revelationActor: ({ spawn }) => spawn('revelation', { systemId: 'revelation' }),
        popActor: ({ spawn }) => spawn('pop', { systemId: 'pop' }),
        visualPresetActor: ({ spawn }) => spawn('visualPreset', { systemId: 'visualPreset' }),
        neonBandsActor: ({ spawn }) => spawn('neonBands', { systemId: 'neonBands' }),
        steeringActor: ({ spawn }) => spawn('steering', { systemId: 'steering' }),
      }),
      on: {
        SHUTDOWN: {
          target: 'stopped',
          actions: assign({
            bloomActor: null,
            lightingActor: null,
            materialActor: null,
            modelActor: null,
            pbrActor: null,
            sceneActor: null,
            performanceActor: null,
            revelationActor: null,
            popActor: null,
            visualPresetActor: null,
            neonBandsActor: null,
            steeringActor: null,
          }),
        },
      },
    },
    stopped: {
      on: {
        INITIALIZE: { target: 'running' },
      },
    },
  },
});
