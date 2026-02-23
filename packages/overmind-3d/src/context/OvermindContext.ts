import { createContext } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { applicationMachine } from '../machines/applicationMachine.ts';

export interface OvermindContextValue {
  actorRef: ActorRefFrom<typeof applicationMachine>;
}

export const OvermindContext = createContext<OvermindContextValue | null>(null);
