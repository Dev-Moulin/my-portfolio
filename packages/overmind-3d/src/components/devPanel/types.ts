import type { ActorRefFrom } from 'xstate';
import type { bloomMachine } from '../../machines/bloomMachine.ts';
import type { lightingMachine } from '../../machines/lightingMachine.ts';
import type { pbrMachine } from '../../machines/pbrMachine.ts';
import type { materialMachine } from '../../machines/materialMachine.ts';
import type { sceneMachine } from '../../machines/sceneMachine.ts';
import type { performanceMonitor } from '../../machines/performanceMachine.ts';
import type { revelationMachine } from '../../machines/revelationMachine.ts';
import type { modelMachine } from '../../machines/modelMachine.ts';
import type { visualPresetMachine } from '../../machines/visualPresetMachine.ts';
import type { neonBandsMachine } from '../../machines/neonBandsMachine.ts';
import type { steeringMachine } from '../../machines/steeringMachine.ts';
import type { timelineMachine } from '../../machines/timelineMachine.ts';
import type { selectionMachine } from '../../machines/selectionMachine.ts';

export interface ContentProps {
  bloomActor: ActorRefFrom<typeof bloomMachine>;
  lightingActor: ActorRefFrom<typeof lightingMachine>;
  pbrActor: ActorRefFrom<typeof pbrMachine>;
  materialActor: ActorRefFrom<typeof materialMachine>;
  sceneActor: ActorRefFrom<typeof sceneMachine>;
  performanceActor: ActorRefFrom<typeof performanceMonitor>;
  revelationActor: ActorRefFrom<typeof revelationMachine>;
  modelActor: ActorRefFrom<typeof modelMachine>;
  visualPresetActor: ActorRefFrom<typeof visualPresetMachine>;
  neonBandsActor: ActorRefFrom<typeof neonBandsMachine>;
  steeringActor: ActorRefFrom<typeof steeringMachine>;
  timelineActor: ActorRefFrom<typeof timelineMachine>;
  selectionActor: ActorRefFrom<typeof selectionMachine>;
}

export const TABS = ['Presets', 'Bloom', 'Neon', 'Lighting', 'PBR', 'Materials', 'Scene', 'Perf', 'Reveal', 'Model', 'Steering', 'ScrollText', 'Outliner', 'Library'] as const;
export type TabId = typeof TABS[number];
