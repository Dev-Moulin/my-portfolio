import type * as THREE from 'three';
import type { TransformData } from './selectionSystem.ts';

export type { TransformData };

/** Context passed to descriptor create/dispose operations */
export interface ComponentContext {
  scene: THREE.Scene;
  registerSelectable: (id: string, object3D: THREE.Object3D) => void;
}

/**
 * Describes a 3D component type declaratively.
 * TConfig = serializable config (NeonInstanceConfig, etc.)
 * TExtra  = non-serializable fields on the instance (system, portalTarget, etc.)
 */
export interface ComponentDescriptor<
  TConfig,
  TExtra extends object = Record<string, never>,
> {
  readonly type: string;
  readonly displayName?: string;
  readonly trackColor?: string;

  create(
    id: string,
    sourceId: string,
    config: TConfig,
    ctx: ComponentContext,
  ): ComponentCreateResult<TExtra>;

  cloneConfig(config: TConfig): TConfig;

  serialize(
    object3D: THREE.Object3D,
    config: TConfig,
    extra: TExtra,
  ): SerializedComponent<TConfig>;

  dispose(
    object3D: THREE.Object3D,
    config: TConfig,
    extra: TExtra,
    ctx: ComponentContext,
  ): void;

  applyConfig(
    object3D: THREE.Object3D,
    config: TConfig,
    patch: Partial<TConfig>,
    extra: TExtra,
  ): void;

  syncFromTransform(
    object3D: THREE.Object3D,
    config: TConfig,
    transform: TransformData,
    extra: TExtra,
  ): void;

  /** Optional lifecycle opacity control (0 = invisible, 1 = fully visible). */
  setOpacity?(
    object3D: THREE.Object3D,
    config: TConfig,
    extra: TExtra,
    opacity: number,
  ): void;
}

export interface ComponentCreateResult<
  TExtra extends object = Record<string, never>,
> {
  object3D: THREE.Object3D;
  extra: TExtra;
}

export interface SerializedComponent<TConfig> {
  config: TConfig;
  position: { x: number; y: number; z: number };
}
