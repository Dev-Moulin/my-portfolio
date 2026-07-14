import type { ScrollCameraAnimator } from './scrollCameraAnimator.ts';

// ── Free-look drag (V1 desktop) ─────────────────────────────────────────────
//  Drag-to-look « tirer le monde » : clic gauche MAINTENU sur le fond de la scène → la caméra
//  tourne (deltas envoyés à ScrollCameraAnimator.applyLookDragDelta, 360° yaw / pitch clampé).
//  - Seuil de quelques pixels avant de devenir un drag → le CLIC des cartes holo reste intact
//    (cardClickSystem déclenche désormais au pointerup, avec le même seuil anti-drag).
//  - Listeners sur WINDOW (le wrapper canvas est pointer-events:none en mode scroll) → on
//    EXCLUT les éléments d'UI : contrôles natifs + panneaux marqués [data-ui-panel].
//  - V1 desktop only (pointerType 'mouse') — le mobile (gyroscope + bouton de bascule) viendra
//    dans un chantier séparé, cf. mémoire freelook_camera_plan.
// ────────────────────────────────────────────────────────────────────────────

const DRAG_THRESHOLD_PX = 4;
const UI_EXCLUDE = 'input, button, a, select, textarea, label, [data-ui-panel]';

export function attachFreeLookDrag(animator: ScrollCameraAnimator): () => void {
  let armed = false;    // bouton enfoncé, seuil pas encore franchi (peut encore être un clic)
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.pointerType !== 'mouse') return;
    if (animator.getState() !== 'dwell') return; // regarder autour = au repos seulement
    const t = e.target as HTMLElement | null;
    if (t && typeof t.closest === 'function' && t.closest(UI_EXCLUDE)) return;
    armed = true;
    dragging = false;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
  };

  const onMove = (e: PointerEvent) => {
    if (!armed) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      animator.beginLookDrag();
    }
    animator.applyLookDragDelta(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    // Réaffirmé chaque move : le hover des cartes (cardClickSystem) pose 'pointer' en concurrence.
    document.body.style.cursor = 'grabbing';
  };

  const end = () => {
    if (dragging) {
      animator.endLookDrag();
      document.body.style.cursor = '';
    }
    armed = false;
    dragging = false;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') end();
  };

  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('blur', end); // perte de focus en plein drag → relâche proprement
  return () => {
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('blur', end);
    end();
  };
}
