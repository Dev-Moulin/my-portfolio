import { useSelector } from '@xstate/react';
import { useCallback } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { visualPresetMachine } from '../machines/visualPresetMachine.ts';
import type { Situation, VisualPreset } from '../data/defaultPresets.ts';

type VisualPresetActor = ActorRefFrom<typeof visualPresetMachine>;

export function useVisualPreset(actorRef: VisualPresetActor) {
  const situation = useSelector(actorRef, (s) => s.context.situation);
  const previousSituation = useSelector(actorRef, (s) => s.context.previousSituation);
  const isTransitioning = useSelector(actorRef, (s) => s.context.isTransitioning);
  const transitionProgress = useSelector(actorRef, (s) => s.context.transitionProgress);
  const presets = useSelector(actorRef, (s) => s.context.presets);
  const transitionDurations = useSelector(actorRef, (s) => s.context.transitionDurations);

  const setSituation = useCallback((sit: Situation) => {
    actorRef.send({ type: 'SET_SITUATION', situation: sit });
  }, [actorRef]);

  const updatePreset = useCallback((sit: Situation, preset: VisualPreset) => {
    actorRef.send({ type: 'UPDATE_PRESET', situation: sit, preset });
  }, [actorRef]);

  const saveCurrentAsPreset = useCallback((sit: Situation, values: VisualPreset) => {
    actorRef.send({ type: 'SAVE_CURRENT_AS_PRESET', situation: sit, values });
  }, [actorRef]);

  const loadPresets = useCallback((p: Record<Situation, VisualPreset>, d?: Record<string, number>) => {
    actorRef.send({ type: 'LOAD_PRESETS', presets: p, durations: d });
  }, [actorRef]);

  const restoreDefaults = useCallback(() => {
    actorRef.send({ type: 'RESTORE_DEFAULTS' });
  }, [actorRef]);

  const exportPresets = useCallback(async () => {
    const data = { presets, transitionDurations };
    const json = JSON.stringify(data, null, 2);

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'overmind-visual-presets.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch {
        return;
      }
    }

    await navigator.clipboard.writeText(json);
  }, [presets, transitionDurations]);

  const importPresets = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.presets) {
          actorRef.send({ type: 'LOAD_PRESETS', presets: data.presets, durations: data.transitionDurations });
        }
      } catch { /* ignore invalid JSON */ }
    };
    reader.readAsText(file);
  }, [actorRef]);

  return {
    situation, previousSituation, isTransitioning, transitionProgress,
    presets, transitionDurations,
    setSituation, updatePreset, saveCurrentAsPreset, loadPresets,
    restoreDefaults, exportPresets, importPresets,
  };
}
