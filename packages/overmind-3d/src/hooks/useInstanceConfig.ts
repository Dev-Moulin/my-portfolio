import { useState, useEffect, useCallback } from 'react';
import type { InstanceType, NeonInstanceConfig, TextInstanceConfig, LightInstanceConfig } from '../scene/instanceRegistry.ts';
import type { BandConfig } from '../machines/neonBandsMachine.ts';

export interface InstanceConfigState {
  id: string;
  type: InstanceType;
  config: NeonInstanceConfig | TextInstanceConfig | LightInstanceConfig;
}

export function useInstanceConfig() {
  const [state, setState] = useState<InstanceConfigState | null>(null);

  // Listen for config pushed by SceneRenderer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InstanceConfigState | null>).detail;
      setState(detail ? { ...detail, config: { ...detail.config } } : null);
    };
    window.addEventListener('overmind:instance-config', handler);
    return () => window.removeEventListener('overmind:instance-config', handler);
  }, []);

  // Send a config patch to SceneRenderer
  const updateField = useCallback((field: string, value: unknown) => {
    if (!state) return;
    // Optimistic UI update
    setState(prev => {
      if (!prev) return null;
      return { ...prev, config: { ...prev.config, [field]: value } };
    });
    window.dispatchEvent(new CustomEvent('overmind:instance-config-update', {
      detail: { id: state.id, patch: { [field]: value } },
    }));
  }, [state?.id]);

  // Helper for updating an individual neon band
  const updateBand = useCallback((index: number, field: keyof BandConfig, value: unknown) => {
    if (!state || state.type !== 'neon') return;
    const config = state.config as NeonInstanceConfig;
    const newBands = config.bands.map((b, i) =>
      i === index ? { ...b, [field]: value } : { ...b }
    );
    setState(prev => {
      if (!prev) return null;
      return { ...prev, config: { ...prev.config, bands: newBands } };
    });
    window.dispatchEvent(new CustomEvent('overmind:instance-config-update', {
      detail: { id: state.id, patch: { bands: newBands } },
    }));
  }, [state?.id, state?.type, (state?.config as NeonInstanceConfig | undefined)?.bands]);

  return state ? { ...state, updateField, updateBand } : null;
}
