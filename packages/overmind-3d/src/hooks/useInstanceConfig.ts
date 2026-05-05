import { useState, useEffect, useCallback } from 'react';
import type { InstanceType, TextInstanceConfig, LightInstanceConfig, CardInstanceConfig } from '../scene/instanceRegistry.ts';

export interface InstanceConfigState {
  id: string;
  type: InstanceType;
  config: TextInstanceConfig | LightInstanceConfig | CardInstanceConfig;
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

  return state ? { ...state, updateField } : null;
}
