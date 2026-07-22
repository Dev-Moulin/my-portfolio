/**
 * Verrou pinch-zoom — iOS Safari IGNORE volontairement `user-scalable=no` (accessibilité,
 * depuis iOS 10) : le méta viewport ne suffit pas. Sans ce verrou, le pinch zoome la page
 * et force Safari à recomposer le canvas WebGL à une résolution démultipliée → mémoire GPU
 * explosée → l'onglet est tué (crash constaté sur iPhone 13 mini).
 *
 * Deux couches (complémentaires, sans effet sur desktop) :
 * - events propriétaires Safari `gesturestart/change/end` (le pinch officiel) → preventDefault ;
 * - filet générique : tout `touchmove` à 2+ doigts → preventDefault (couvre les navigateurs
 *   sans events gesture*). Les gestes à 1 doigt (tap, swipe, parallaxe) passent intacts.
 */
export function blockPinchZoom(): void {
  const prevent = (e: Event) => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(type, prevent, { passive: false });
  }
  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
}
