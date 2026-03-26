import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const PIP_LAYER = 1;

export class PIPViewport {
  readonly pipCamera: THREE.OrthographicCamera;
  private controls: OrbitControls | null = null;
  private gridHelper: THREE.GridHelper;
  private axesHelper: THREE.AxesHelper;
  private scene: THREE.Scene;
  private savedClearColor = new THREE.Color();
  private savedClearAlpha = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Orthographic camera — bird's eye 3/4 isometric view
    this.pipCamera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 1000);
    this.pipCamera.position.set(30, 30, 30);
    this.pipCamera.lookAt(0, 0, 0);
    this.pipCamera.layers.enableAll(); // See layer 0 (scene) + layer 1 (PIP helpers)

    // PIP-only helpers (layer 1 — invisible in main viewport)
    this.gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
    this.gridHelper.layers.set(PIP_LAYER);
    scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.layers.set(PIP_LAYER);
    scene.add(this.axesHelper);
  }

  attachControls(overlayElement: HTMLDivElement): void {
    if (this.controls) this.controls.dispose();
    this.controls = new OrbitControls(this.pipCamera, overlayElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
  }

  render(
    renderer: THREE.WebGLRenderer,
    pipX: number, pipY: number, pipW: number, pipH: number,
  ): void {
    // Save current clear color
    renderer.getClearColor(this.savedClearColor);
    this.savedClearAlpha = renderer.getClearAlpha();

    // Reset WebGL state after EffectComposer (blend mode, depth test, textures, render target)
    renderer.setRenderTarget(null);
    renderer.state.reset();

    // PIP viewport render
    renderer.setScissorTest(true);
    renderer.setScissor(pipX, pipY, pipW, pipH);
    renderer.setViewport(pipX, pipY, pipW, pipH);
    renderer.setClearColor(0x111111, 1);
    renderer.clear(true, true, false);
    renderer.render(this.scene, this.pipCamera);

    // Restore
    renderer.setScissorTest(false);
    renderer.setClearColor(this.savedClearColor, this.savedClearAlpha);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  }

  update(): void {
    this.controls?.update();
  }

  dispose(): void {
    this.controls?.dispose();
    this.scene.remove(this.gridHelper);
    this.scene.remove(this.axesHelper);
    this.gridHelper.dispose();
    this.axesHelper.dispose();
  }
}
