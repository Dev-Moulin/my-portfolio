import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useActorRef } from '@xstate/react';
import { OvermindContext } from './OvermindContext.ts';
import { applicationMachine } from '../machines/applicationMachine.ts';

interface OvermindProviderProps {
  children: ReactNode;
}

export function OvermindProvider({ children }: OvermindProviderProps) {
  const actorRef = useActorRef(applicationMachine);

  const contextValue = useMemo(
    () => ({ actorRef }),
    [actorRef],
  );

  return (
    <OvermindContext.Provider value={contextValue}>
      {children}
    </OvermindContext.Provider>
  );
}
