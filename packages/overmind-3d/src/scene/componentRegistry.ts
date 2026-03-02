import type * as THREE from 'three';
import type {
  ComponentDescriptor,
  ComponentContext,
  TransformData,
} from './componentDescriptor.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Type-erased instance stored internally by ComponentRegistry. */
export interface AnyComponentInstance {
  readonly id: string;
  readonly type: string;
  readonly sourceId: string;
  readonly object3D: THREE.Object3D;
  config: unknown;
  extra: unknown;
}

/** Typed variant — consumers who know the descriptor type can cast to this. */
export interface ComponentInstance<
  TConfig,
  TExtra extends object = Record<string, never>,
> {
  readonly id: string;
  readonly type: string;
  readonly sourceId: string;
  readonly object3D: THREE.Object3D;
  config: TConfig;
  extra: TExtra;
}

/** Serializable snapshot of a single component instance. */
export interface ComponentSnapshot {
  id: string;
  type: string;
  sourceId: string;
  config: unknown;
  position: { x: number; y: number; z: number };
}

/** Side-effect hooks for reconcile(). */
export interface ReconcileHooks {
  onCreated?: (instance: AnyComponentInstance) => void;
  onRemoved?: (id: string, instance: AnyComponentInstance) => void;
  onUpdated?: (instance: AnyComponentInstance) => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Type-safe registration helper: erases TConfig/TExtra for internal storage. */
export function asAnyDescriptor<TConfig, TExtra extends object>(
  d: ComponentDescriptor<TConfig, TExtra>,
): ComponentDescriptor<unknown, object> {
  return d as ComponentDescriptor<unknown, object>;
}

// ---------------------------------------------------------------------------
// ComponentRegistry
// ---------------------------------------------------------------------------

export class ComponentRegistry {
  private instances = new Map<string, AnyComponentInstance>();
  private counters = new Map<string, number>();
  private descriptors = new Map<string, ComponentDescriptor<unknown, object>>();

  constructor(descriptors: ComponentDescriptor<unknown, object>[]) {
    for (const d of descriptors) {
      this.descriptors.set(d.type, d);
    }
  }

  // ── ID generation ────────────────────────────────────────────────────────

  nextId(sourceId: string): string {
    const count = (this.counters.get(sourceId) ?? 0) + 1;
    this.counters.set(sourceId, count);
    return `${sourceId}_${count}`;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  add(instance: AnyComponentInstance): void {
    this.instances.set(instance.id, instance);
  }

  remove(id: string): AnyComponentInstance | undefined {
    const inst = this.instances.get(id);
    if (inst) this.instances.delete(id);
    return inst;
  }

  get(id: string): AnyComponentInstance | undefined {
    return this.instances.get(id);
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }

  getAll(): AnyComponentInstance[] {
    return Array.from(this.instances.values());
  }

  getByType(type: string): AnyComponentInstance[] {
    return this.getAll().filter(i => i.type === type);
  }

  resolveObject(id: string): THREE.Object3D | null {
    return this.instances.get(id)?.object3D ?? null;
  }

  getDescriptor(type: string): ComponentDescriptor<unknown, object> | undefined {
    return this.descriptors.get(type);
  }

  // ── Generic create ────────────────────────────────────────────────────────

  create(
    type: string,
    sourceId: string,
    config: unknown,
    ctx: ComponentContext,
    explicitId?: string,
  ): AnyComponentInstance {
    const descriptor = this.descriptors.get(type);
    if (!descriptor) throw new Error(`Unknown component type: ${type}`);

    const id = explicitId ?? this.nextId(sourceId);
    const clonedConfig = descriptor.cloneConfig(config);
    const { object3D, extra } = descriptor.create(id, sourceId, clonedConfig, ctx);

    const instance: AnyComponentInstance = {
      id, type, sourceId, object3D,
      config: clonedConfig,
      extra,
    };
    this.add(instance);
    return instance;
  }

  // ── Generic duplicate (replaces duplicateNeon/Text/Light/Card) ────────────

  duplicate(
    source: AnyComponentInstance,
    ctx: ComponentContext,
    positionOffset = { x: 2, y: 0, z: 0 },
  ): AnyComponentInstance {
    const descriptor = this.descriptors.get(source.type);
    if (!descriptor) throw new Error(`Unknown component type: ${source.type}`);

    const clonedConfig = descriptor.cloneConfig(source.config);
    const instance = this.create(source.type, source.sourceId, clonedConfig, ctx);

    // Copy source position + offset
    instance.object3D.position.copy(source.object3D.position);
    instance.object3D.position.x += positionOffset.x;
    instance.object3D.position.y += positionOffset.y;
    instance.object3D.position.z += positionOffset.z;

    // Sync config from new position
    descriptor.syncFromTransform(
      instance.object3D,
      instance.config,
      {
        position: instance.object3D.position.clone(),
        rotation: instance.object3D.rotation.clone(),
        scale: instance.object3D.scale.clone(),
      } as TransformData,
      instance.extra as object,
    );

    return instance;
  }

  // ── Generic restore (replaces restoreNeon/Text/Light/Card) ────────────────

  restore(
    snapshot: ComponentSnapshot,
    ctx: ComponentContext,
  ): AnyComponentInstance {
    const instance = this.create(
      snapshot.type,
      snapshot.sourceId,
      snapshot.config,
      ctx,
      snapshot.id,
    );
    instance.object3D.position.set(
      snapshot.position.x,
      snapshot.position.y,
      snapshot.position.z,
    );
    return instance;
  }

  // ── Descriptor delegation ─────────────────────────────────────────────────

  applyConfig(id: string, patch: Record<string, unknown>): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    const descriptor = this.descriptors.get(instance.type);
    if (!descriptor) return;
    descriptor.applyConfig(
      instance.object3D,
      instance.config,
      patch as Partial<unknown>,
      instance.extra as object,
    );
  }

  syncFromTransform(id: string, transform: TransformData): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    const descriptor = this.descriptors.get(instance.type);
    if (!descriptor) return;
    descriptor.syncFromTransform(
      instance.object3D,
      instance.config,
      transform,
      instance.extra as object,
    );
  }

  setOpacity(id: string, opacity: number): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    const descriptor = this.descriptors.get(instance.type);
    descriptor?.setOpacity?.(instance.object3D, instance.config, instance.extra as object, opacity);
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  disposeOne(id: string, ctx: ComponentContext): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    const descriptor = this.descriptors.get(instance.type);
    if (descriptor) {
      descriptor.dispose(instance.object3D, instance.config, instance.extra as object, ctx);
    }
    this.instances.delete(id);
  }

  disposeAll(ctx: ComponentContext): void {
    for (const instance of this.instances.values()) {
      const descriptor = this.descriptors.get(instance.type);
      if (descriptor) {
        descriptor.dispose(instance.object3D, instance.config, instance.extra as object, ctx);
      }
    }
    this.instances.clear();
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  captureAllSnapshots(): ComponentSnapshot[] {
    return this.getAll().map(instance => {
      const descriptor = this.descriptors.get(instance.type)!;
      const serialized = descriptor.serialize(
        instance.object3D,
        instance.config,
        instance.extra as object,
      );
      return {
        id: instance.id,
        type: instance.type,
        sourceId: instance.sourceId,
        config: serialized.config,
        position: serialized.position,
      };
    });
  }

  // ── Diff-reconciliation ───────────────────────────────────────────────────

  reconcile(
    snapshots: ComponentSnapshot[],
    ctx: ComponentContext,
    hooks?: ReconcileHooks,
  ): void {
    const currentIds = new Set(this.instances.keys());
    const snapIds = new Set(snapshots.map(s => s.id));

    // 1. Remove instances not in snapshot
    for (const id of currentIds) {
      if (!snapIds.has(id)) {
        const instance = this.instances.get(id)!;
        const descriptor = this.descriptors.get(instance.type);
        if (descriptor) {
          descriptor.dispose(instance.object3D, instance.config, instance.extra as object, ctx);
        }
        this.instances.delete(id);
        hooks?.onRemoved?.(id, instance);
      }
    }

    // 2. Restore missing, update existing
    for (const snapshot of snapshots) {
      if (!currentIds.has(snapshot.id)) {
        const instance = this.restore(snapshot, ctx);
        hooks?.onCreated?.(instance);
      } else {
        const existing = this.instances.get(snapshot.id)!;
        const descriptor = this.descriptors.get(existing.type);
        if (!descriptor) continue;

        const clonedConfig = descriptor.cloneConfig(snapshot.config);
        existing.object3D.position.set(
          snapshot.position.x,
          snapshot.position.y,
          snapshot.position.z,
        );
        // Replace config entirely
        descriptor.applyConfig(
          existing.object3D,
          existing.config,
          clonedConfig as Partial<unknown>,
          existing.extra as object,
        );
        // Update stored config reference
        (existing as { config: unknown }).config = clonedConfig;
        hooks?.onUpdated?.(existing);
      }
    }
  }
}
