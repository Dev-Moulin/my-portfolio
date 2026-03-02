import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

const CARD_SCALE = 0.005;       // 380px × 0.005 = 1.9 unités 3D
const CARD_WIDTH_PX = 380;
const CARD_HEIGHT_PX = 280;

export class CardSystem {
  private css3dObject: CSS3DObject;
  private proxyMesh: THREE.Mesh;
  private cardElement: HTMLDivElement;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Élément DOM hôte pour le portal React
    this.cardElement = document.createElement('div');
    this.cardElement.style.width = `${CARD_WIDTH_PX}px`;
    this.cardElement.style.minHeight = `${CARD_HEIGHT_PX}px`;
    this.cardElement.style.pointerEvents = 'auto';

    // 2. CSS3DObject — wraps the DOM element in 3D space
    this.css3dObject = new CSS3DObject(this.cardElement);
    this.css3dObject.scale.setScalar(CARD_SCALE);
    this.css3dObject.position.set(5, 3, 0); // position par défaut (à calibrer)
    scene.add(this.css3dObject);

    // 3. Mesh proxy invisible pour raycasting (SelectionSystem)
    const w3d = CARD_WIDTH_PX * CARD_SCALE;
    const h3d = CARD_HEIGHT_PX * CARD_SCALE;
    const geo = new THREE.PlaneGeometry(w3d, h3d);
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
    this.proxyMesh = new THREE.Mesh(geo, mat);
    this.proxyMesh.userData.selectableId = 'card';
    this.proxyMesh.position.copy(this.css3dObject.position);
    scene.add(this.proxyMesh);
  }

  /** Élément DOM dans lequel React rend le contenu via createPortal */
  getPortalTarget(): HTMLDivElement {
    return this.cardElement;
  }

  /** Proxy mesh pour le SelectionSystem (raycasting) */
  getProxyMesh(): THREE.Mesh {
    return this.proxyMesh;
  }

  /** CSS3DObject pour accès direct */
  getCSS3DObject(): CSS3DObject {
    return this.css3dObject;
  }

  /** Gizmo déplace le proxy → synchroniser CSS3DObject */
  syncProxyToCSS3D(): void {
    this.css3dObject.position.copy(this.proxyMesh.position);
    this.css3dObject.rotation.copy(this.proxyMesh.rotation);
    // Scale: proxy uses raw value, CSS3D needs × CARD_SCALE
    const s = this.proxyMesh.scale.x;
    this.css3dObject.scale.setScalar(CARD_SCALE * s);
  }

  /** Désactiver/réactiver les pointer events sur l'élément HTML (pendant gizmo) */
  setInteractive(enabled: boolean): void {
    this.cardElement.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  /** Element track override — position */
  setPosition(x: number, y: number, z: number): void {
    this.proxyMesh.position.set(x, y, z);
    this.css3dObject.position.set(x, y, z);
  }

  /** Element track override — rotation */
  setRotation(x: number, y: number, z: number): void {
    this.proxyMesh.rotation.set(x, y, z);
    this.css3dObject.rotation.set(x, y, z);
  }

  /** Element track override — scale (proxy uses raw, CSS3D uses × CARD_SCALE) */
  setScale(s: number): void {
    this.proxyMesh.scale.setScalar(s);
    this.css3dObject.scale.setScalar(CARD_SCALE * s);
  }

  /** Opacité CSS (pour la transition d'entrée de la card) */
  setOpacity(opacity: number): void {
    this.cardElement.style.opacity = String(opacity);
    this.cardElement.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
    this.proxyMesh.visible = opacity > 0;
  }

  dispose(): void {
    this.scene.remove(this.css3dObject);
    this.scene.remove(this.proxyMesh);
    this.proxyMesh.geometry.dispose();
    (this.proxyMesh.material as THREE.Material).dispose();
  }
}
