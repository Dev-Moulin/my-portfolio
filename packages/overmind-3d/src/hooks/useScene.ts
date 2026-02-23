import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { sceneMachine } from '../machines/sceneMachine.ts';

export function useScene(actorRef: ActorRefFrom<typeof sceneMachine>) {
  const backgroundColor = useSelector(actorRef, (state) => state.context.backgroundColor);
  const cameraX = useSelector(actorRef, (state) => state.context.cameraX);
  const cameraY = useSelector(actorRef, (state) => state.context.cameraY);
  const cameraZ = useSelector(actorRef, (state) => state.context.cameraZ);
  const lookAtX = useSelector(actorRef, (state) => state.context.lookAtX);
  const lookAtY = useSelector(actorRef, (state) => state.context.lookAtY);
  const lookAtZ = useSelector(actorRef, (state) => state.context.lookAtZ);
  const fov = useSelector(actorRef, (state) => state.context.fov);
  const gridVisible = useSelector(actorRef, (state) => state.context.gridVisible);
  const gridSize = useSelector(actorRef, (state) => state.context.gridSize);
  const gridDivisions = useSelector(actorRef, (state) => state.context.gridDivisions);
  const gridColor1 = useSelector(actorRef, (state) => state.context.gridColor1);
  const gridColor2 = useSelector(actorRef, (state) => state.context.gridColor2);
  const axesVisible = useSelector(actorRef, (state) => state.context.axesVisible);
  const axesSize = useSelector(actorRef, (state) => state.context.axesSize);

  const setBackgroundColor = (color: string) => { actorRef.send({ type: 'SET_BACKGROUND_COLOR', color }); };
  const updateCameraPosition = (x: number, y: number, z: number) => { actorRef.send({ type: 'UPDATE_CAMERA_POSITION', x, y, z }); };
  const updateLookAt = (x: number, y: number, z: number) => { actorRef.send({ type: 'UPDATE_LOOK_AT', x, y, z }); };
  const updateFov = (fov: number) => { actorRef.send({ type: 'UPDATE_FOV', fov }); };
  const toggleGrid = () => { actorRef.send({ type: 'TOGGLE_GRID' }); };
  const showGrid = () => { actorRef.send({ type: 'SHOW_GRID' }); };
  const hideGrid = () => { actorRef.send({ type: 'HIDE_GRID' }); };
  const updateGridSize = (size: number) => { actorRef.send({ type: 'UPDATE_GRID_SIZE', size }); };
  const updateGridDivisions = (divisions: number) => { actorRef.send({ type: 'UPDATE_GRID_DIVISIONS', divisions }); };
  const updateGridColors = (color1: string, color2: string) => { actorRef.send({ type: 'UPDATE_GRID_COLORS', color1, color2 }); };
  const toggleAxes = () => { actorRef.send({ type: 'TOGGLE_AXES' }); };
  const showAxes = () => { actorRef.send({ type: 'SHOW_AXES' }); };
  const hideAxes = () => { actorRef.send({ type: 'HIDE_AXES' }); };
  const updateAxesSize = (size: number) => { actorRef.send({ type: 'UPDATE_AXES_SIZE', size }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    backgroundColor,
    cameraX, cameraY, cameraZ, lookAtX, lookAtY, lookAtZ, fov,
    gridVisible, gridSize, gridDivisions, gridColor1, gridColor2,
    axesVisible, axesSize,
    setBackgroundColor,
    updateCameraPosition, updateLookAt, updateFov,
    toggleGrid, showGrid, hideGrid, updateGridSize, updateGridDivisions, updateGridColors,
    toggleAxes, showAxes, hideAxes, updateAxesSize,
    restoreDefaults
  };
}
