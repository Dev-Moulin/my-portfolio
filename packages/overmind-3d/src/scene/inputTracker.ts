/**
 * InputTracker — position souris/touch en NDC (−1..1), mise à jour par listeners globaux.
 * Consommée chaque frame par le look-around caméra (`cameraAnimator.setPointerNDC`).
 *
 * `tick(dt)` DOIT être appelé chaque frame AVANT de lire `mouseNDC` : en régime normal il recopie la
 * position brute (réactif), mais juste après une RÉ-ENTRÉE de la souris (retour sur la fenêtre après un
 * recentrage) il lisse `mouseNDC` vers la brute pendant un court instant → évite l'à-coup « panique »
 * quand la souris rentre par un bord puis file vers le centre.
 */
export class InputTracker {
  mouseNDC = { x: 0, y: 0 };
  private rawX = 0;               // cible brute (dernière position souris/touch)
  private rawY = 0;
  private smoothT = 0;            // s restantes de lissage doux (fenêtre de ré-entrée)
  private awayRecentered = false; // la souris est restée absente assez longtemps pour être recentrée

  attach(): () => void {
    // Délai avant recentrage quand la souris quitte la fenêtre (ms) + durée du lissage doux appliqué à
    // la ré-entrée (s). Le lissage n'est actif QUE dans cette fenêtre → look-around normal reste réactif.
    const RECENTER_DELAY_MS = 1000;
    const REENTRY_SMOOTH_S = 1.0;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelLeave = () => { if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null; } };

    const onMouseMove = (e: MouseEvent) => {
      cancelLeave(); // souris de retour → on annule le recentrage programmé
      this.rawX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.rawY = -(e.clientY / window.innerHeight - 0.5) * 2;
      // Ré-entrée après un recentrage effectif → lisse le rattrapage (sinon saut centre→bord = à-coup).
      if (this.awayRecentered) { this.smoothT = REENTRY_SMOOTH_S; this.awayRecentered = false; }
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      this.rawX = (touch.clientX / window.innerWidth - 0.5) * 2;
      this.rawY = -(touch.clientY / window.innerHeight - 0.5) * 2;
    };

    // Souris SORTIE de la fenêtre → recentrer la CIBLE (0,0) APRÈS RECENTER_DELAY_MS : sans ça la
    // position reste figée sur le dernier bord et le look-around garde la caméra penchée (multi-écrans).
    // `mouseleave` = curseur hors fenêtre ; `blur` = focus perdu (autre appli/écran). Annulé si la
    // souris revient avant le délai (elle reprend la main).
    const onLeave = () => {
      if (leaveTimer !== null) return; // déjà programmé (mouseleave ET blur peuvent tomber ensemble)
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        this.rawX = 0;
        this.rawY = 0;
        this.smoothT = 0;           // recentrage franc de la cible (le retour reste doux via lookYaw)
        this.awayRecentered = true; // arme le lissage de la prochaine ré-entrée
      }, RECENTER_DELAY_MS);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);

    return () => {
      cancelLeave();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }

  /** Chaque frame, AVANT lecture de mouseNDC. Recopie la position brute — sauf pendant la fenêtre de
   *  ré-entrée où mouseNDC est lissé vers la brute (rattrapage mou, pas d'à-coup gauche-droite). */
  tick(dt: number): void {
    if (this.smoothT > 0) {
      const k = 1 - Math.exp(-dt / 0.35); // τ≈0.35 s : rattrapage doux pendant la ré-entrée
      this.mouseNDC.x += (this.rawX - this.mouseNDC.x) * k;
      this.mouseNDC.y += (this.rawY - this.mouseNDC.y) * k;
      this.smoothT -= dt;
    } else {
      this.mouseNDC.x = this.rawX;
      this.mouseNDC.y = this.rawY;
    }
  }
}
