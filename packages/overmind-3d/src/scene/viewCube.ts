import * as THREE from 'three';
import type CameraControls from 'camera-controls';
import { ViewportGizmo } from 'three-viewport-gizmo';

export class ViewCubeWrapper {
  private gizmo: ViewportGizmo;
  private cameraControls: CameraControls;
  private enabled = true;

  constructor(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    cameraControls: CameraControls,
  ) {
    this.cameraControls = cameraControls;

    this.gizmo = new ViewportGizmo(camera, renderer, {
      type: 'sphere',
      size: 100,
      placement: 'top-right',
      animated: true,
      speed: 2,
      offset: { top: 10, right: 10 },
      background: { enabled: true, color: 0x111111, opacity: 0.6 },
    });

    // Sync target with CameraControls
    const target = cameraControls.getTarget(new THREE.Vector3());
    this.gizmo.target.copy(target);

    // Events: disable/enable CameraControls during gizmo interaction
    this.gizmo.addEventListener('start', () => {
      cameraControls.enabled = false;
    });

    this.gizmo.addEventListener('end', () => {
      // Sync CameraControls to wherever the gizmo moved the camera
      const pos = camera.position;
      const t = this.gizmo.target;
      cameraControls.setLookAt(pos.x, pos.y, pos.z, t.x, t.y, t.z, false);
      cameraControls.enabled = true;
    });
  }

  setVisible(visible: boolean): void {
    this.enabled = visible;
    this.gizmo.enabled = visible;
  }

  render(): void {
    if (!this.enabled) return;
    // Sync target before render
    this.cameraControls.getTarget(this.gizmo.target);
    this.gizmo.render();
  }

  update(): void {
    this.gizmo.update();
  }

  dispose(): void {
    this.gizmo.dispose();
  }
}
