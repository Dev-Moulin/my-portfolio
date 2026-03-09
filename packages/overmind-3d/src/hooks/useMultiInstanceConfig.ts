import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InstanceType } from '../scene/instanceRegistry.ts';

// ── MIXED sentinel ──────────────────────────────────────────────────────────

export const MIXED: unique symbol = Symbol('mixed');

// ── Types ───────────────────────────────────────────────────────────────────

export interface InstanceEntry {
  id: string;
  type: InstanceType;
  config: Record<string, unknown>;
}

export interface MultiInstanceConfigState {
  instances: InstanceEntry[];
  /** null when types are mixed */
  commonType: InstanceType | null;
  /** Merged values (shared fields). null when types are mixed. MIXED symbol for differing values. */
  mergedConfig: Record<string, unknown> | null;
  /** Set of field names that have mixed values across selected instances */
  mixedFields: Set<string>;
  /** Update a field on ALL selected instances */
  updateAll: (field: string, value: unknown) => void;
}

// ── Merge utility ───────────────────────────────────────────────────────────

function mergeConfigs(configs: Record<string, unknown>[]): {
  merged: Record<string, unknown>;
  mixed: Set<string>;
} {
  if (configs.length === 0) return { merged: {}, mixed: new Set() };
  if (configs.length === 1) return { merged: { ...configs[0] }, mixed: new Set() };

  const merged: Record<string, unknown> = {};
  const mixed = new Set<string>();
  const keys = Object.keys(configs[0]);

  for (const key of keys) {
    // V1: skip array fields (e.g. neon bands) — always MIXED
    if (Array.isArray(configs[0][key])) {
      merged[key] = MIXED;
      mixed.add(key);
      continue;
    }

    const first = configs[0][key];
    let allSame = true;
    for (let i = 1; i < configs.length; i++) {
      const val = configs[i][key];
      if (typeof first === 'object' && first !== null) {
        if (JSON.stringify(val) !== JSON.stringify(first)) { allSame = false; break; }
      } else {
        if (val !== first) { allSame = false; break; }
      }
    }

    if (allSame) {
      merged[key] = first;
    } else {
      merged[key] = MIXED;
      mixed.add(key);
    }
  }

  return { merged, mixed };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useMultiInstanceConfig(): MultiInstanceConfigState | null {
  const [instances, setInstances] = useState<InstanceEntry[] | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InstanceEntry[] | null>).detail;
      setInstances(detail && detail.length > 0 ? detail : null);
    };
    window.addEventListener('overmind:multi-instance-config', handler);
    return () => window.removeEventListener('overmind:multi-instance-config', handler);
  }, []);

  const commonType = useMemo<InstanceType | null>(() => {
    if (!instances || instances.length === 0) return null;
    const first = instances[0].type;
    return instances.every(i => i.type === first) ? first : null;
  }, [instances]);

  const { merged, mixed } = useMemo(() => {
    if (!instances || !commonType) return { merged: null, mixed: new Set<string>() };
    return mergeConfigs(instances.map(i => i.config));
  }, [instances, commonType]);

  const updateAll = useCallback((field: string, value: unknown) => {
    if (!instances) return;
    // Optimistic UI update
    setInstances(prev => {
      if (!prev) return null;
      return prev.map(inst => ({
        ...inst,
        config: { ...inst.config, [field]: value },
      }));
    });
    // Dispatch to configBridge for each instance
    for (const inst of instances) {
      window.dispatchEvent(new CustomEvent('overmind:instance-config-update', {
        detail: { id: inst.id, patch: { [field]: value } },
      }));
    }
  }, [instances]);

  if (!instances || instances.length === 0) return null;

  return {
    instances,
    commonType,
    mergedConfig: merged,
    mixedFields: mixed,
    updateAll,
  };
}
