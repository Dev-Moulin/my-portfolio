import * as THREE from 'three';
import { Text } from 'troika-three-text';
import type { TextInstanceConfig } from '../instanceRegistry.ts';
import type {
  ComponentDescriptor,
  ComponentCreateResult,
  SerializedComponent,
} from '../componentDescriptor.ts';

type TextExtra = Record<string, never>;

export const textDescriptor: ComponentDescriptor<TextInstanceConfig, TextExtra> = {
  type: 'text',
  displayName: 'Text',
  trackColor: '#81C784',

  create(id, _sourceId, config, ctx): ComponentCreateResult<TextExtra> {
    const mesh = new Text();
    mesh.text = config.text;
    mesh.font = config.font;
    mesh.fontSize = config.fontSize;
    mesh.anchorX = config.anchorX as 'center' | 'left' | 'right';
    mesh.anchorY = config.anchorY as 'middle' | 'top' | 'bottom';
    mesh.textAlign = config.textAlign as 'center' | 'left' | 'right';
    if (config.maxWidth) mesh.maxWidth = config.maxWidth;
    mesh.color = new THREE.Color(config.color).multiplyScalar(config.emissiveIntensity);
    mesh.userData.selectableId = id;
    mesh.sync();

    ctx.scene.add(mesh);
    ctx.registerSelectable(id, mesh);

    return { object3D: mesh, extra: {} as TextExtra };
  },

  cloneConfig(config): TextInstanceConfig {
    return { ...config };
  },

  serialize(object3D, config): SerializedComponent<TextInstanceConfig> {
    return {
      config: this.cloneConfig(config),
      position: { x: object3D.position.x, y: object3D.position.y, z: object3D.position.z },
    };
  },

  dispose(object3D, _config, _extra, ctx): void {
    if ('dispose' in object3D && typeof object3D.dispose === 'function') {
      (object3D as { dispose: () => void }).dispose();
    }
    ctx.scene.remove(object3D);
  },

  applyConfig(object3D, config, patch): void {
    Object.assign(config, patch);
    const mesh = object3D as unknown as {
      text: string; fontSize: number; color: unknown; sync: () => void;
    };
    if (patch.text !== undefined) mesh.text = config.text;
    if (patch.fontSize !== undefined) mesh.fontSize = config.fontSize;
    if (patch.color !== undefined || patch.emissiveIntensity !== undefined) {
      mesh.color = new THREE.Color(config.color).multiplyScalar(config.emissiveIntensity);
    }
    mesh.sync();
  },

  syncFromTransform(): void {
    // Text has no positionX/Y/Z in its config — position lives on the Object3D only
  },

  setOpacity(object3D, _config, _extra, opacity): void {
    object3D.visible = opacity > 0;
    const mesh = object3D as unknown as { material?: { transparent: boolean; opacity: number } };
    if (mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = opacity;
    }
  },
};
