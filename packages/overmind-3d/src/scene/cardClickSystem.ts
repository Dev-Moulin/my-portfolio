import * as THREE from 'three';
import type { HoloCardEntry } from './holoScreenShader.ts';
import type { ScrollCameraAnimator } from './scrollCameraAnimator.ts';

// ── Card Click System ───────────────────────────────────────────────────────
//  - Raycast pointermove → hover glow + cursor pointer sur la card "active"
//    (= celle face au lastRestPoint courant de l'animator).
//  - Pointerdown : click sur card active en dwell → enterReading.
//                  click ailleurs en reading → exitReading.
//  - ESC : exitReading.
// ────────────────────────────────────────────────────────────────────────────

export class CardClickSystem {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private cardEntries: HoloCardEntry[];
  private animator: ScrollCameraAnimator;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private cardMeshes: THREE.Object3D[];
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    cardEntries: HoloCardEntry[],
    animator: ScrollCameraAnimator,
  ) {
    this.camera = camera;
    this.domElement = renderer.domElement;
    this.cardEntries = cardEntries;
    this.animator = animator;
    this.cardMeshes = cardEntries.map(e => e.mesh);

    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);

    // NOTE: window listeners (pas domElement) car en mode scroll le wrapper
    // canvas a pointer-events:none → les events n'arrivent jamais à domElement.
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('keydown', this.boundKeyDown);
  }

  private updateNDC(e: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastCard(): HoloCardEntry | null {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.cardMeshes, false);
    if (hits.length === 0) return null;
    const hit = hits[0].object;
    return this.cardEntries.find(e => e.mesh === hit) ?? null;
  }

  private onPointerMove(e: PointerEvent): void {
    const state = this.animator.getState();
    // Hover only matters in dwell or reading
    if (state !== 'dwell' && state !== 'reading') {
      this.animator.setHoverCard(null);
      document.body.style.cursor = '';
      return;
    }
    this.updateNDC(e);
    const entry = this.raycastCard();
    if (entry) {
      this.animator.setHoverCard(entry.cardIdx);
      document.body.style.cursor = 'pointer';
    } else {
      this.animator.setHoverCard(null);
      document.body.style.cursor = '';
    }
  }

  private onPointerDown(e: PointerEvent): void {
    const state = this.animator.getState();
    if (state !== 'dwell' && state !== 'reading') return;
    this.updateNDC(e);
    const entry = this.raycastCard();

    if (state === 'dwell') {
      if (entry) {
        this.animator.enterReading(entry.cardIdx);
      }
      return;
    }

    // state === 'reading' : click hors card → exit
    if (!entry) {
      this.animator.exitReading();
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.animator.getState() === 'reading') {
      this.animator.exitReading();
    }
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('keydown', this.boundKeyDown);
    document.body.style.cursor = '';
  }
}
