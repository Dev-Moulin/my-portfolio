import * as THREE from 'three';
import type { LightInstanceConfig } from '../instanceRegistry.ts';
import type {
  ComponentDescriptor,
  ComponentCreateResult,
  SerializedComponent,
  TransformData,
} from '../componentDescriptor.ts';
import { VolumetricCone } from '../volumetricCone.ts';

export interface LightExtra {
  target?: THREE.Object3D;
  volumetricCone?: VolumetricCone;
  proxyMesh?: THREE.Mesh;
  trackToTargetId?: string;
}

// ── Proxy mesh for raycasting (lights have no geometry) ─────────────────────

const PROXY_GEO = new THREE.SphereGeometry(0.35, 8, 8);
const PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });

// ── Target-from-rotation helper ──────────────────────────────────────────────

const TARGET_DISTANCE = 5;
const _forward = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function updateTargetFromRotation(
  object3D: THREE.Object3D,
  config: LightInstanceConfig,
  target: THREE.Object3D,
): void {
  _quat.setFromEuler(object3D.rotation);
  _forward.set(0, 0, -1).applyQuaternion(_quat); // Blender convention: -Z forward

  target.position.set(
    object3D.position.x + _forward.x * TARGET_DISTANCE,
    object3D.position.y + _forward.y * TARGET_DISTANCE,
    object3D.position.z + _forward.z * TARGET_DISTANCE,
  );

  config.targetX = target.position.x;
  config.targetY = target.position.y;
  config.targetZ = target.position.z;
}

// ── Volumetric cone helpers ──────────────────────────────────────────────────

function createVolCone(light: THREE.SpotLight, config: LightInstanceConfig): VolumetricCone {
  const cone = new VolumetricCone(
    new THREE.Color(config.color),
    config.angle ?? Math.PI / 6,
    config.distance ?? 10,
  );
  cone.syncWithLight(light);
  light.parent!.add(cone.mesh);
  return cone;
}

function destroyVolCone(extra: LightExtra): void {
  if (!extra.volumetricCone) return;
  extra.volumetricCone.mesh.parent?.remove(extra.volumetricCone.mesh);
  extra.volumetricCone.dispose();
  extra.volumetricCone = undefined;
}

// ── Descriptor ───────────────────────────────────────────────────────────────

export const lightDescriptor: ComponentDescriptor<LightInstanceConfig, LightExtra> = {
  type: 'light',
  displayName: 'Light',
  trackColor: '#90A4AE',

  create(id, _sourceId, config, ctx): ComponentCreateResult<LightExtra> {
    let light: THREE.Light;
    let target: THREE.Object3D | undefined;

    switch (config.lightType) {
      case 'point':
        light = new THREE.PointLight(config.color, config.intensity, config.distance ?? 0);
        break;
      case 'directional': {
        const dl = new THREE.DirectionalLight(config.color, config.intensity);
        ctx.scene.add(dl.target);
        target = dl.target;
        light = dl;
        break;
      }
      case 'spot': {
        const sl = new THREE.SpotLight(
          config.color, config.intensity,
          config.distance ?? 10, config.angle ?? Math.PI / 6,
          config.penumbra ?? 0.3, config.decay ?? 2,
        );
        ctx.scene.add(sl.target);
        target = sl.target;
        light = sl;
        break;
      }
      case 'area':
        light = new THREE.RectAreaLight(
          config.color, config.intensity,
          config.areaWidth ?? 2, config.areaHeight ?? 2,
        );
        break;
      default:
        light = new THREE.PointLight(config.color, config.intensity);
    }

    light.position.set(config.positionX, config.positionY, config.positionZ);

    // Restore rotation if present
    if (config.rotationX !== undefined || config.rotationY !== undefined || config.rotationZ !== undefined) {
      light.rotation.set(config.rotationX ?? 0, config.rotationY ?? 0, config.rotationZ ?? 0);
    }

    // Position target: from rotation if available, otherwise from config values
    if (target) {
      if (config.rotationX !== undefined || config.rotationY !== undefined || config.rotationZ !== undefined) {
        updateTargetFromRotation(light, config, target);
      } else {
        target.position.set(config.targetX ?? 0, config.targetY ?? 0, config.targetZ ?? 0);
      }
    }

    light.userData.selectableId = id;

    // Invisible proxy mesh for raycasting (lights have no geometry)
    const proxyMesh = new THREE.Mesh(PROXY_GEO, PROXY_MAT);
    light.add(proxyMesh);

    ctx.scene.add(light);
    ctx.registerSelectable(id, light);

    // Notify LightHelperSystem to attach a visual helper
    window.dispatchEvent(new CustomEvent('overmind:light-helper-attach', { detail: { id, light } }));

    // Volumetric cone (spot only)
    const extra: LightExtra = { target, proxyMesh };
    if (config.volumetric && light instanceof THREE.SpotLight) {
      extra.volumetricCone = createVolCone(light, config);
    }

    return { object3D: light, extra };
  },

  cloneConfig(config): LightInstanceConfig {
    return { ...config };
  },

  serialize(object3D, config): SerializedComponent<LightInstanceConfig> {
    return {
      config: {
        ...this.cloneConfig(config),
        rotationX: object3D.rotation.x,
        rotationY: object3D.rotation.y,
        rotationZ: object3D.rotation.z,
      },
      position: { x: object3D.position.x, y: object3D.position.y, z: object3D.position.z },
    };
  },

  dispose(object3D, _config, extra, ctx): void {
    // Detach light helper before removing from scene
    const id = object3D.userData.selectableId as string | undefined;
    if (id) {
      window.dispatchEvent(new CustomEvent('overmind:light-helper-detach', { detail: { id } }));
    }
    // Remove proxy mesh
    if (extra.proxyMesh) {
      object3D.remove(extra.proxyMesh);
      extra.proxyMesh = undefined;
    }
    // Remove volumetric cone
    destroyVolCone(extra);
    // Remove target from scene if present (spot/directional)
    if (extra.target) {
      ctx.scene.remove(extra.target);
    }
    ctx.scene.remove(object3D);
    if ('dispose' in object3D && typeof object3D.dispose === 'function') {
      (object3D as { dispose: () => void }).dispose();
    }
  },

  applyConfig(object3D, config, patch, extra): void {
    Object.assign(config, patch);
    const light = object3D as THREE.Light;

    // Common properties
    if (patch.color !== undefined) light.color.set(config.color);
    if (patch.intensity !== undefined) light.intensity = config.intensity;
    if (patch.positionX !== undefined) light.position.x = config.positionX;
    if (patch.positionY !== undefined) light.position.y = config.positionY;
    if (patch.positionZ !== undefined) light.position.z = config.positionZ;

    // Point + Spot: distance
    if (patch.distance !== undefined && 'distance' in light) {
      (light as THREE.PointLight).distance = config.distance ?? 0;
    }

    // Spot-specific
    if (light instanceof THREE.SpotLight) {
      if (patch.angle !== undefined) light.angle = config.angle ?? Math.PI / 6;
      if (patch.penumbra !== undefined) light.penumbra = config.penumbra ?? 0.3;
      if (patch.decay !== undefined) light.decay = config.decay ?? 2;
    }

    // Rotation from DevPanel
    if (patch.rotationX !== undefined) light.rotation.x = config.rotationX ?? 0;
    if (patch.rotationY !== undefined) light.rotation.y = config.rotationY ?? 0;
    if (patch.rotationZ !== undefined) light.rotation.z = config.rotationZ ?? 0;

    // Track To: store target ID in extra
    if (patch.trackToTargetId !== undefined) {
      extra.trackToTargetId = config.trackToTargetId || undefined;
    }

    // Recalculate target if rotation changed (skip if Track To is active — it takes priority)
    if (!extra.trackToTargetId && extra.target && (patch.rotationX !== undefined || patch.rotationY !== undefined || patch.rotationZ !== undefined)) {
      updateTargetFromRotation(light, config, extra.target);
    }
    // Manual target position (only if rotation didn't change — rotation takes priority)
    else if (!extra.trackToTargetId && extra.target && (patch.targetX !== undefined || patch.targetY !== undefined || patch.targetZ !== undefined)) {
      if (patch.targetX !== undefined) extra.target.position.x = config.targetX ?? 0;
      if (patch.targetY !== undefined) extra.target.position.y = config.targetY ?? 0;
      if (patch.targetZ !== undefined) extra.target.position.z = config.targetZ ?? 0;
    }

    // Area: width/height
    if (light instanceof THREE.RectAreaLight) {
      if (patch.areaWidth !== undefined) light.width = config.areaWidth ?? 2;
      if (patch.areaHeight !== undefined) light.height = config.areaHeight ?? 2;
    }

    // Volumetric cone toggle + sync
    if (patch.volumetric !== undefined) {
      if (config.volumetric && light instanceof THREE.SpotLight && !extra.volumetricCone) {
        extra.volumetricCone = createVolCone(light as THREE.SpotLight, config);
      } else if (!config.volumetric) {
        destroyVolCone(extra);
      }
    }

    // Sync existing cone when light properties change
    if (extra.volumetricCone && light instanceof THREE.SpotLight) {
      if (patch.color !== undefined) {
        extra.volumetricCone.setColor(new THREE.Color(config.color));
      }
      if (patch.angle !== undefined || patch.distance !== undefined) {
        extra.volumetricCone.rebuild(config.angle ?? Math.PI / 6, config.distance ?? 10);
      }
      extra.volumetricCone.syncWithLight(light);
    }
  },

  syncFromTransform(object3D, config, transform: TransformData, extra): void {
    // Capture old values before updating
    const oldPosX = config.positionX;
    const oldPosY = config.positionY;
    const oldPosZ = config.positionZ;
    const oldRotX = config.rotationX ?? 0;
    const oldRotY = config.rotationY ?? 0;
    const oldRotZ = config.rotationZ ?? 0;

    // Update config
    config.positionX = transform.position.x;
    config.positionY = transform.position.y;
    config.positionZ = transform.position.z;
    config.rotationX = transform.rotation.x;
    config.rotationY = transform.rotation.y;
    config.rotationZ = transform.rotation.z;

    // Spot/Directional: sync target (skip if Track To is active — animation loop handles it)
    if (extra.target && !extra.trackToTargetId) {
      const EPS = 1e-6;
      const rotChanged =
        Math.abs(oldRotX - transform.rotation.x) > EPS ||
        Math.abs(oldRotY - transform.rotation.y) > EPS ||
        Math.abs(oldRotZ - transform.rotation.z) > EPS;

      if (rotChanged) {
        // Rotation changed → recalculate target from forward vector
        updateTargetFromRotation(object3D, config, extra.target);
      } else {
        // Translation only → move target by same delta to preserve direction
        const dx = transform.position.x - oldPosX;
        const dy = transform.position.y - oldPosY;
        const dz = transform.position.z - oldPosZ;
        extra.target.position.x += dx;
        extra.target.position.y += dy;
        extra.target.position.z += dz;
        config.targetX = extra.target.position.x;
        config.targetY = extra.target.position.y;
        config.targetZ = extra.target.position.z;
      }
    }

    // Sync volumetric cone
    if (extra.volumetricCone && object3D instanceof THREE.SpotLight) {
      extra.volumetricCone.syncWithLight(object3D);
    }
  },

  setOpacity(object3D, config, extra, opacity): void {
    // Lights stay visible (for raycasting via proxy mesh) — only intensity changes
    (object3D as THREE.Light).intensity = config.intensity * opacity;
    // Volumetric cone follows light opacity
    if (extra.volumetricCone) {
      extra.volumetricCone.setOpacity(opacity);
    }
  },
};
