import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── State ────────────────────────────────────────────────────────────────────

interface LassoState {
  points: { x: number; y: number }[];
  shiftHeld: boolean;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class LassoSelectOverlay {
  private host: SelectionHost;
  private state: LassoState | null = null;
  private active = false;

  private overlayCanvas: HTMLCanvasElement | null = null;
  private savedCursor = '';

  // Persistent listener (non-capture) on the canvas to detect Ctrl+RMB
  private boundCanvasMouseDown: ((e: MouseEvent) => void) | null = null;

  // Capture-phase listeners while active
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;

  private hudCallback: ((text: string | null) => void) | null = null;

  constructor(host: SelectionHost) {
    this.host = host;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  isActive(): boolean {
    return this.active;
  }

  setHudCallback(cb: (text: string | null) => void): void {
    this.hudCallback = cb;
  }

  /** Attach persistent Ctrl+RMB listener on the canvas. */
  attach(): void {
    this.boundCanvasMouseDown = (e: MouseEvent) => this.onCanvasMouseDown(e);
    this.host.getCanvas().addEventListener('mousedown', this.boundCanvasMouseDown);
  }

  cancel(): void {
    if (!this.active) return;
    this.cleanup();
    this.active = false;
    this.state = null;
    this.host.fireDraggingChanged(false);
  }

  dispose(): void {
    if (this.active) this.cancel();
    if (this.boundCanvasMouseDown) {
      this.host.getCanvas().removeEventListener('mousedown', this.boundCanvasMouseDown);
      this.boundCanvasMouseDown = null;
    }
  }

  // ── Private: trigger ─────────────────────────────────────────────────────

  private onCanvasMouseDown(e: MouseEvent): void {
    // Only Ctrl+RMB triggers lasso
    if (e.button !== 2 || !e.ctrlKey) return;
    if (this.active) return;
    if (this.host.isAnyModalActive()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    this.active = true;

    // Freeze camera
    this.host.fireDraggingChanged(true);

    // Record first point and shift state
    this.state = {
      points: [{ x: e.clientX, y: e.clientY }],
      shiftHeld: e.shiftKey,
    };

    // Create canvas overlay
    const container = this.host.getCanvas().parentElement;
    if (container) {
      this.overlayCanvas = document.createElement('canvas');
      Object.assign(this.overlayCanvas.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        pointerEvents: 'none',
        zIndex: '9998',
      });
      this.overlayCanvas.width = container.clientWidth;
      this.overlayCanvas.height = container.clientHeight;
      container.appendChild(this.overlayCanvas);
    }

    // Crosshair cursor
    this.savedCursor = this.host.getCanvas().style.cursor;
    this.host.getCanvas().style.cursor = 'crosshair';

    // Attach capture-phase listeners for modal isolation
    this.boundMouseMove = (ev: MouseEvent) => this.onMouseMove(ev);
    this.boundMouseUp = (ev: MouseEvent) => this.onMouseUp(ev);
    this.boundKeyDown = (ev: KeyboardEvent) => this.onKeyDown(ev);
    this.boundContextMenu = (ev: Event) => { ev.preventDefault(); ev.stopImmediatePropagation(); };

    window.addEventListener('mousemove', this.boundMouseMove, true);
    window.addEventListener('mouseup', this.boundMouseUp, true);
    window.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('contextmenu', this.boundContextMenu, true);

    this.hudCallback?.('Lasso Select');
  }

  // ── Private: event handlers ──────────────────────────────────────────────

  private onMouseMove(e: MouseEvent): void {
    if (!this.active || !this.state) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    this.state.points.push({ x: e.clientX, y: e.clientY });
    this.redraw();
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.active || !this.state) return;
    if (e.button !== 2) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    this.state.points.push({ x: e.clientX, y: e.clientY });
    this.performSelection();
    this.cancel();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.key === 'Escape') {
      this.cancel();
    }
  }

  // ── Private: selection logic ─────────────────────────────────────────────

  private performSelection(): void {
    if (!this.state || this.state.points.length < 3) return;

    // Convert points to container-relative coords for comparison with projected positions
    const matchedIds: string[] = [];
    const allIds = this.host.getAllIds();

    for (const id of allIds) {
      if (!this.host.isObjectVisible(id)) continue;
      if (this.host.isObjectLocked(id)) continue;

      const obj = this.host.getSelectables().get(id);
      if (!obj) continue;

      const screen = this.projectToScreen(obj);
      if (!screen) continue;

      if (this.pointInPolygon(screen.x, screen.y)) {
        matchedIds.push(id);
      }
    }

    // Shift → merge with existing selection
    if (this.state.shiftHeld) {
      const existing = this.host.getSelectedIds();
      const merged = new Set([...existing, ...matchedIds]);
      this.host.restoreSelection(Array.from(merged));
    } else {
      if (matchedIds.length > 0) {
        this.host.restoreSelection(matchedIds);
      } else {
        this.host.restoreSelection([]);
      }
    }
  }

  /** Ray-casting point-in-polygon algorithm. */
  private pointInPolygon(px: number, py: number): boolean {
    const pts = this.state!.points;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private projectToScreen(obj: THREE.Object3D): { x: number; y: number } | null {
    const vec = new THREE.Vector3();
    obj.getWorldPosition(vec);
    vec.project(this.host.getCamera());

    // Behind camera → exclude
    if (vec.z > 1) return null;

    const rect = this.host.getCanvas().getBoundingClientRect();
    return {
      x: (vec.x + 1) / 2 * rect.width + rect.left,
      y: (1 - vec.y) / 2 * rect.height + rect.top,
    };
  }

  // ── Private: overlay rendering ───────────────────────────────────────────

  private redraw(): void {
    if (!this.overlayCanvas || !this.state) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;

    const containerRect = this.host.getCanvas().getBoundingClientRect();
    const pts = this.state.points;

    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x - containerRect.left, pts[0].y - containerRect.top);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x - containerRect.left, pts[i].y - containerRect.top);
    }
    ctx.closePath();

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 152, 0, 0.1)';
    ctx.fill();
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  private cleanup(): void {
    // Remove overlay canvas
    if (this.overlayCanvas) {
      this.overlayCanvas.parentElement?.removeChild(this.overlayCanvas);
      this.overlayCanvas = null;
    }

    // Restore cursor
    this.host.getCanvas().style.cursor = this.savedCursor;

    // Remove capture-phase listeners
    if (this.boundMouseMove) {
      window.removeEventListener('mousemove', this.boundMouseMove, true);
      this.boundMouseMove = null;
    }
    if (this.boundMouseUp) {
      window.removeEventListener('mouseup', this.boundMouseUp, true);
      this.boundMouseUp = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown, true);
      this.boundKeyDown = null;
    }
    if (this.boundContextMenu) {
      window.removeEventListener('contextmenu', this.boundContextMenu, true);
      this.boundContextMenu = null;
    }

    this.hudCallback?.(null);
  }
}
