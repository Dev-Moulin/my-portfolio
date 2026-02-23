import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { modelMachine } from '../machines/modelMachine.ts';

export function useModel(actor: ActorRefFrom<typeof modelMachine>) {
  const ctx = useSelector(actor, (s) => s.context);

  function setPosition(x: number, y: number, z: number) {
    actor.send({ type: 'SET_POSITION', x, y, z });
  }

  function setScale(scale: number) {
    actor.send({ type: 'SET_SCALE', scale });
  }

  function setBaseRotationY(value: number) {
    actor.send({ type: 'SET_BASE_ROTATION_Y', value });
  }

  function setMouseSensitivity(value: number) {
    actor.send({ type: 'SET_MOUSE_SENSITIVITY', value });
  }

  function setMouseReturnSpeed(value: number) {
    actor.send({ type: 'SET_MOUSE_RETURN_SPEED', value });
  }

  function setMouseDeadZone(value: number) {
    actor.send({ type: 'SET_MOUSE_DEAD_ZONE', value });
  }

  function setMouseMaxRotY(value: number) {
    actor.send({ type: 'SET_MOUSE_MAX_ROT_Y', value });
  }

  function setMouseMaxRotX(value: number) {
    actor.send({ type: 'SET_MOUSE_MAX_ROT_X', value });
  }

  function setMouseInactiveMs(value: number) {
    actor.send({ type: 'SET_MOUSE_INACTIVE_MS', value });
  }

  function reset() {
    actor.send({ type: 'RESET' });
  }

  return {
    ...ctx,
    setPosition, setScale, setBaseRotationY,
    setMouseSensitivity, setMouseReturnSpeed, setMouseDeadZone,
    setMouseMaxRotY, setMouseMaxRotX, setMouseInactiveMs,
    reset,
  };
}
