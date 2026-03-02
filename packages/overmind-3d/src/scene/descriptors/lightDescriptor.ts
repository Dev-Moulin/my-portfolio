import * as THREE from 'three';
import type { LightInstanceConfig } from '../instanceRegistry.ts';
import type {
  ComponentDescriptor,
  ComponentCreateResult,
  SerializedComponent,
  TransformData,
} from '../componentDescriptor.ts';

type LightExtra = Record<string, never>;

export const lightDescriptor: ComponentDescriptor<LightInstanceConfig, LightExtra> = {
  type: 'light',
  displayName: 'Light',
  trackColor: '#90A4AE',

  create(id, _sourceId, config, ctx): ComponentCreateResult<LightExtra> {
    let light: THREE.Light;
    if (config.lightType === 'point') {
      light = new THREE.PointLight(config.color, config.intensity, config.distance ?? 0);
    } else {
      light = new THREE.DirectionalLight(config.color, config.intensity);
    }
    light.position.set(config.positionX, config.positionY, config.positionZ);
    light.userData.selectableId = id;

    ctx.scene.add(light);
    ctx.registerSelectable(id, light);

    return { object3D: light, extra: {} as LightExtra };
  },

  cloneConfig(config): LightInstanceConfig {
    return { ...config };
  },

  serialize(object3D, config): SerializedComponent<LightInstanceConfig> {
    return {
      config: this.cloneConfig(config),
      position: { x: object3D.position.x, y: object3D.position.y, z: object3D.position.z },
    };
  },

  dispose(object3D, _config, _extra, ctx): void {
    ctx.scene.remove(object3D);
    if ('dispose' in object3D && typeof object3D.dispose === 'function') {
      (object3D as { dispose: () => void }).dispose();
    }
  },

  applyConfig(object3D, config, patch): void {
    Object.assign(config, patch);
    const light = object3D as THREE.Light;
    if (patch.color !== undefined) light.color.set(config.color);
    if (patch.intensity !== undefined) light.intensity = config.intensity;
    if (patch.positionX !== undefined) light.position.x = config.positionX;
    if (patch.positionY !== undefined) light.position.y = config.positionY;
    if (patch.positionZ !== undefined) light.position.z = config.positionZ;
    if (patch.distance !== undefined && 'distance' in light) {
      (light as THREE.PointLight).distance = config.distance ?? 0;
    }
  },

  syncFromTransform(_object3D, config, transform: TransformData): void {
    config.positionX = transform.position.x;
    config.positionY = transform.position.y;
    config.positionZ = transform.position.z;
  },

  setOpacity(object3D, config, _extra, opacity): void {
    object3D.visible = opacity > 0;
    (object3D as THREE.Light).intensity = config.intensity * opacity;
  },
};
