import * as THREE from 'three';
import type { HoloCardEntry } from './holoScreenShader.ts';
import type { ScrollCameraAnimator } from './scrollCameraAnimator.ts';

// ── Card Click System ───────────────────────────────────────────────────────
//  - Raycast pointermove → hover glow + cursor pointer sur la card "active"
//    (= celle face au lastRestPoint courant de l'animator).
//  - CLIC (pointerup, avec seuil anti-drag : un déplacement > quelques px entre down et up est
//    un drag free-look, pas un clic) : sur card active en dwell → enterReading ;
//    ailleurs en reading → exitReading.
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
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerCancel: (e: PointerEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundOnboarding: (e: Event) => void;
  private downX = 0;
  private downY = 0;
  private downValid = false;
  private activePointers = new Set<number>(); // doigts actifs → un pinch (>1) n'est jamais un tap
  // Verrou tuto (PR E) : pendant l'onboarding, l'OUVERTURE de carte n'est permise QU'À l'étape « écran ».
  // Ailleurs (avant/après cette étape, tant que le tuto tourne) le clic est ignoré → le visiteur suit le
  // parcours sans ouvrir une carte au mauvais moment. La FERMETURE (exit/ESC) reste toujours libre.
  private cardLockedByTuto = false;

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
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundPointerCancel = this.onPointerCancel.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundOnboarding = this.onOnboarding.bind(this);

    // NOTE: window listeners (pas domElement) car en mode scroll le wrapper
    // canvas a pointer-events:none → les events n'arrivent jamais à domElement.
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerCancel);
    window.addEventListener('keydown', this.boundKeyDown);
    // Le bridge tuto diffuse son état ici → on en déduit le verrou d'ouverture (voir onOnboarding).
    window.addEventListener('overmind:onboarding', this.boundOnboarding);
  }

  // Verrou (PR E) : tuto en cours (`active`) ET pas à l'étape « écran » → ouverture de carte interdite.
  // Tuto fini/absent → `active` false → verrou levé → clic normal.
  private onOnboarding(e: Event): void {
    const d = (e as CustomEvent<{ active?: boolean; screen?: { active?: boolean } }>).detail;
    this.cardLockedByTuto = !!d?.active && !d?.screen?.active;
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
    // Verrou tuto : en dwell hors étape écran, l'ouverture est interdite → pas de glow/pointer qui
    // inviterait à cliquer pour rien. (En reading on ne touche pas : la fermeture reste guidée/libre.)
    if (state === 'dwell' && this.cardLockedByTuto) {
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
    this.activePointers.add(e.pointerId);
    // 2e doigt = pinch (zoom lecture) en cours → ce n'est pas un tap : on invalide le clic.
    if (this.activePointers.size > 1) { this.downValid = false; return; }
    // Le CLIC se décide au pointerup : ici on mémorise juste l'origine pour le seuil anti-drag.
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downValid = true;
  }

  private onPointerCancel(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    this.downValid = false;
  }

  private onPointerUp(e: PointerEvent): void {
    const wasMultiTouch = this.activePointers.size > 1; // relâché d'un pinch → jamais un tap
    this.activePointers.delete(e.pointerId);
    if (wasMultiTouch || !this.downValid) { this.downValid = false; return; }
    this.downValid = false;
    // Anti tap-through : un tap qui visait un contrôle UI DOM (NavArc, SKIP, slider…) ne doit
    // JAMAIS traverser vers la carte 3D derrière — on écoute window, donc on filtre par cible.
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('button, .arc-menu-container, .arc-color-slider')) return;
    // Déplacement au-delà du seuil = drag free-look (cf. freeLookDrag), pas un clic.
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) >= 4) return;
    const state = this.animator.getState();
    if (state !== 'dwell' && state !== 'reading') return;
    this.updateNDC(e);
    const entry = this.raycastCard();

    if (state === 'dwell') {
      // Verrou tuto : ouverture permise uniquement à l'étape « écran » (sinon on ignore le clic).
      if (entry && !this.cardLockedByTuto) {
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
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerCancel);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('overmind:onboarding', this.boundOnboarding);
    document.body.style.cursor = '';
  }
}
