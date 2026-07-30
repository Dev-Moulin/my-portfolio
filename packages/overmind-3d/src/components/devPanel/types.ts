import type { ActorRefFrom } from 'xstate';
import type { bloomMachine } from '../../machines/bloomMachine.ts';
import type { lightsMachine } from '../../machines/lightsMachine.ts';
import type { pbrMachine } from '../../machines/pbrMachine.ts';
import type { materialMachine } from '../../machines/materialMachine.ts';
import type { sceneMachine } from '../../machines/sceneMachine.ts';
import type { performanceMonitor } from '../../machines/performanceMachine.ts';
import type { revelationMachine } from '../../machines/revelationMachine.ts';
import type { visualPresetMachine } from '../../machines/visualPresetMachine.ts';
import type { timelineMachine } from '../../machines/timelineMachine.ts';
import type { selectionMachine } from '../../machines/selectionMachine.ts';

export interface ContentProps {
  bloomActor: ActorRefFrom<typeof bloomMachine>;
  lightsActor: ActorRefFrom<typeof lightsMachine>;
  pbrActor: ActorRefFrom<typeof pbrMachine>;
  materialActor: ActorRefFrom<typeof materialMachine>;
  sceneActor: ActorRefFrom<typeof sceneMachine>;
  performanceActor: ActorRefFrom<typeof performanceMonitor>;
  revelationActor: ActorRefFrom<typeof revelationMachine>;
  visualPresetActor: ActorRefFrom<typeof visualPresetMachine>;
  timelineActor: ActorRefFrom<typeof timelineMachine>;
  selectionActor: ActorRefFrom<typeof selectionMachine>;
}

export const TABS = ['Presets', 'Bloom', 'PBR', 'Materials', 'Scene', 'Starfield', 'Perf', 'Reveal', 'ScrollText', 'Properties', 'Library'] as const;
export type TabId = typeof TABS[number];
