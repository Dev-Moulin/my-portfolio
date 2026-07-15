/**
 * InputTracker — position souris/touch en NDC (−1..1), mise à jour par listeners globaux.
 * Consommée chaque frame par le look-around caméra (`cameraAnimator.setPointerNDC`).
 */
export class InputTracker {
  mouseNDC = { x: 0, y: 0 };

  attach(): () => void {
    const onMouseMove = (e: MouseEvent) => {
      this.mouseNDC.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouseNDC.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      this.mouseNDC.x = (touch.clientX / window.innerWidth - 0.5) * 2;
      this.mouseNDC.y = -(touch.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }
}
