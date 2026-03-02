import { NeonBandsSystem } from '../neonBands.ts';
import type { NeonInstanceConfig } from '../instanceRegistry.ts';
import type {
  ComponentDescriptor,
  ComponentCreateResult,
  SerializedComponent,
  TransformData,
} from '../componentDescriptor.ts';

export interface NeonExtra {
  system: NeonBandsSystem;
}

export const neonDescriptor: ComponentDescriptor<NeonInstanceConfig, NeonExtra> = {
  type: 'neon',
  displayName: 'Neon',
  trackColor: '#CE93D8',

  create(id, _sourceId, config, ctx): ComponentCreateResult<NeonExtra> {
    const system = new NeonBandsSystem(ctx.scene, config);
    const group = system.getGroup();
    group.userData.selectableId = id;
    ctx.registerSelectable(id, group);
    return { object3D: group, extra: { system } };
  },

  cloneConfig(config): NeonInstanceConfig {
    return { ...config, bands: config.bands.map(b => ({ ...b })) };
  },

  serialize(object3D, config): SerializedComponent<NeonInstanceConfig> {
    return {
      config: this.cloneConfig(config),
      position: { x: object3D.position.x, y: object3D.position.y, z: object3D.position.z },
    };
  },

  dispose(_object3D, _config, extra): void {
    extra.system.dispose();
  },

  applyConfig(_object3D, config, patch, extra): void {
    Object.assign(config, patch);
    extra.system.syncFromState(config);
  },

  syncFromTransform(_object3D, config, transform: TransformData, extra): void {
    config.positionX = transform.position.x;
    config.positionY = transform.position.y;
    config.positionZ = transform.position.z;
    config.scale = transform.scale.x;
    extra.system.syncFromState(config);
  },

  setOpacity(object3D, _config, _extra, opacity): void {
    object3D.visible = opacity > 0;
  },
};
