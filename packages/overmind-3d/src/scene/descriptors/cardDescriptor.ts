import { CardSystem } from '../cardSystem.ts';
import type { CardInstanceConfig } from '../instanceRegistry.ts';
import type {
  ComponentDescriptor,
  ComponentCreateResult,
  SerializedComponent,
  TransformData,
} from '../componentDescriptor.ts';

export interface CardExtra {
  system: CardSystem;
  portalTarget: HTMLDivElement;
}

export const cardDescriptor: ComponentDescriptor<CardInstanceConfig, CardExtra> = {
  type: 'card',
  displayName: 'Card',
  trackColor: '#FFB74D',

  create(id, _sourceId, config, ctx): ComponentCreateResult<CardExtra> {
    const system = new CardSystem(ctx.scene);
    system.setPosition(config.positionX, config.positionY, config.positionZ);
    system.setScale(config.scale);

    const proxy = system.getProxyMesh();
    proxy.userData.selectableId = id;
    ctx.registerSelectable(id, proxy);

    return {
      object3D: proxy,
      extra: { system, portalTarget: system.getPortalTarget() },
    };
  },

  cloneConfig(config): CardInstanceConfig {
    return { ...config };
  },

  serialize(object3D, config): SerializedComponent<CardInstanceConfig> {
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
    if (patch.positionX !== undefined || patch.positionY !== undefined || patch.positionZ !== undefined) {
      extra.system.setPosition(config.positionX, config.positionY, config.positionZ);
    }
    if (patch.scale !== undefined) {
      extra.system.setScale(config.scale);
    }
  },

  syncFromTransform(_object3D, config, transform: TransformData, extra): void {
    config.positionX = transform.position.x;
    config.positionY = transform.position.y;
    config.positionZ = transform.position.z;
    config.scale = transform.scale.x;
    extra.system.syncProxyToCSS3D();
  },

  setOpacity(_object3D, _config, extra, opacity): void {
    extra.system.setOpacity(opacity);
  },
};
