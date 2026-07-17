import type { ScrollCameraAnimator } from './scrollCameraAnimator.ts';

/**
 * attachIdleActivity — réarme le compteur d'inactivité de l'animator sur toute interaction
 * utilisateur (souris qui bouge, scroll, clic, touche, tactile). Sortie de l'attract mode +
 * remise à zéro du délai. La SORTIE de la fenêtre (mouseleave/blur) n'est volontairement PAS
 * comptée comme activité : c'est justement l'écran délaissé qu'on veut animer.
 *
 * Retourne une fonction de détachement (à appeler au cleanup), comme attachFreeLookDrag.
 */
export function attachIdleActivity(animator: ScrollCameraAnimator): () => void {
  const onActivity = () => animator.notifyActivity();

  window.addEventListener('pointermove', onActivity);
  window.addEventListener('wheel', onActivity, { passive: true });
  window.addEventListener('pointerdown', onActivity);
  window.addEventListener('keydown', onActivity);
  window.addEventListener('touchstart', onActivity, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onActivity);
    window.removeEventListener('wheel', onActivity);
    window.removeEventListener('pointerdown', onActivity);
    window.removeEventListener('keydown', onActivity);
    window.removeEventListener('touchstart', onActivity);
  };
}
