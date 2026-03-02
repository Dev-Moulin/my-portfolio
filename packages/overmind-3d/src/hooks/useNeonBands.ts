import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { neonBandsMachine } from '../machines/neonBandsMachine.ts';

export function useNeonBands(actorRef: ActorRefFrom<typeof neonBandsMachine>) {
  const bands = useSelector(actorRef, (state) => state.context.bands);
  const flowSpeed = useSelector(actorRef, (state) => state.context.flowSpeed);
  const flowEnabled = useSelector(actorRef, (state) => state.context.flowEnabled);
  const globalIntensity = useSelector(actorRef, (state) => state.context.globalIntensity);
  const bandSpacing = useSelector(actorRef, (state) => state.context.bandSpacing);
  const positionX = useSelector(actorRef, (state) => state.context.positionX);
  const positionY = useSelector(actorRef, (state) => state.context.positionY);
  const positionZ = useSelector(actorRef, (state) => state.context.positionZ);
  const scale = useSelector(actorRef, (state) => state.context.scale);
  const arcRadius = useSelector(actorRef, (state) => state.context.arcRadius);
  const depthSpread = useSelector(actorRef, (state) => state.context.depthSpread);
  const lineLength = useSelector(actorRef, (state) => state.context.lineLength);
  const cylinderMode = useSelector(actorRef, (state) => state.context.cylinderMode);
  const cylinderRadius = useSelector(actorRef, (state) => state.context.cylinderRadius);
  const cylinderCopies = useSelector(actorRef, (state) => state.context.cylinderCopies);
  const cylinderAutoFill = useSelector(actorRef, (state) => state.context.cylinderAutoFill);
  const cylinderDirection = useSelector(actorRef, (state) => state.context.cylinderDirection);

  const updateBandColor = (index: number, color: string) => {
    actorRef.send({ type: 'UPDATE_BAND_COLOR', index, color });
  };
  const updateBandIntensity = (index: number, intensity: number) => {
    actorRef.send({ type: 'UPDATE_BAND_INTENSITY', index, intensity });
  };
  const updateBandWidth = (index: number, width: number) => {
    actorRef.send({ type: 'UPDATE_BAND_WIDTH', index, width });
  };
  const toggleBandVisible = (index: number) => {
    actorRef.send({ type: 'TOGGLE_BAND_VISIBLE', index });
  };
  const updateFlowSpeed = (speed: number) => {
    actorRef.send({ type: 'UPDATE_FLOW_SPEED', speed });
  };
  const toggleFlow = () => { actorRef.send({ type: 'TOGGLE_FLOW' }); };
  const updateGlobalIntensity = (intensity: number) => {
    actorRef.send({ type: 'UPDATE_GLOBAL_INTENSITY', intensity });
  };
  const updateBandSpacing = (spacing: number) => {
    actorRef.send({ type: 'UPDATE_BAND_SPACING', spacing });
  };
  const updatePositionX = (x: number) => {
    actorRef.send({ type: 'UPDATE_POSITION_X', x });
  };
  const updatePositionY = (y: number) => {
    actorRef.send({ type: 'UPDATE_POSITION_Y', y });
  };
  const updatePositionZ = (z: number) => {
    actorRef.send({ type: 'UPDATE_POSITION_Z', z });
  };
  const updateScale = (scale: number) => {
    actorRef.send({ type: 'UPDATE_SCALE', scale });
  };
  const updateArcRadius = (radius: number) => {
    actorRef.send({ type: 'UPDATE_ARC_RADIUS', radius });
  };
  const updateDepthSpread = (spread: number) => {
    actorRef.send({ type: 'UPDATE_DEPTH_SPREAD', spread });
  };
  const updateLineLength = (length: number) => {
    actorRef.send({ type: 'UPDATE_LINE_LENGTH', length });
  };
  const applyPreset = (presetName: string) => {
    actorRef.send({ type: 'APPLY_PRESET', presetName });
  };
  const setAllWidths = (width: number) => {
    actorRef.send({ type: 'SET_ALL_WIDTHS', width });
  };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };
  const toggleCylinderMode = () => { actorRef.send({ type: 'TOGGLE_CYLINDER_MODE' }); };
  const updateCylinderRadius = (radius: number) => { actorRef.send({ type: 'UPDATE_CYLINDER_RADIUS', radius }); };
  const updateCylinderCopies = (copies: number) => { actorRef.send({ type: 'UPDATE_CYLINDER_COPIES', copies }); };
  const toggleCylinderAutoFill = () => { actorRef.send({ type: 'TOGGLE_CYLINDER_AUTO_FILL' }); };
  const updateCylinderDirection = (direction: 'outward' | 'inward') => { actorRef.send({ type: 'UPDATE_CYLINDER_DIRECTION', direction }); };

  return {
    bands, flowSpeed, flowEnabled, globalIntensity, bandSpacing,
    positionX, positionY, positionZ, scale,
    arcRadius, depthSpread, lineLength,
    cylinderMode, cylinderRadius, cylinderCopies, cylinderAutoFill, cylinderDirection,
    updateBandColor, updateBandIntensity, updateBandWidth, toggleBandVisible,
    updateFlowSpeed, toggleFlow, updateGlobalIntensity, updateBandSpacing,
    updatePositionX, updatePositionY, updatePositionZ, updateScale,
    updateArcRadius, updateDepthSpread, updateLineLength,
    toggleCylinderMode, updateCylinderRadius, updateCylinderCopies,
    toggleCylinderAutoFill, updateCylinderDirection,
    applyPreset, setAllWidths, restoreDefaults,
  };
}
