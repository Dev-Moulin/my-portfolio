import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { performanceMonitor } from '../machines/performanceMachine.ts';

export function usePerformance(actorRef: ActorRefFrom<typeof performanceMonitor>) {
  const isMonitoring = useSelector(actorRef, (state) => state.context.isMonitoring);
  const fps = useSelector(actorRef, (state) => state.context.fps);
  const fpsHistory = useSelector(actorRef, (state) => state.context.fpsHistory);
  const memoryUsed = useSelector(actorRef, (state) => state.context.memoryUsed);
  const memoryLimit = useSelector(actorRef, (state) => state.context.memoryLimit);
  const memoryUsedPercent = useSelector(actorRef, (state) => state.context.memoryUsedPercent);
  const rendererInfo = useSelector(actorRef, (state) => state.context.rendererInfo);

  const startMonitoring = () => { actorRef.send({ type: 'START_MONITORING' }); };
  const stopMonitoring = () => { actorRef.send({ type: 'STOP_MONITORING' }); };
  const updateFPS = (fps: number) => { actorRef.send({ type: 'UPDATE_FPS', fps }); };
  const updateMemory = (used: number, limit: number) => { actorRef.send({ type: 'UPDATE_MEMORY', used, limit }); };
  const updateRendererInfo = (info: {
    triangles: number;
    geometries: number;
    textures: number;
    programs: number;
    calls: number;
  }) => { actorRef.send({ type: 'UPDATE_RENDERER_INFO', info }); };
  const clearHistory = () => { actorRef.send({ type: 'CLEAR_HISTORY' }); };

  return {
    isMonitoring, fps, fpsHistory,
    memoryUsed, memoryLimit, memoryUsedPercent, rendererInfo,
    startMonitoring, stopMonitoring, updateFPS,
    updateMemory, updateRendererInfo, clearHistory
  };
}
