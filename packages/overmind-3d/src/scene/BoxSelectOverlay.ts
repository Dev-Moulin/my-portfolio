import * as THREE from 'three';
import type { SelectionHost } from './selectionSystem.ts';

// ── State ────────────────────────────────────────────────────────────────────

interface BoxSelectState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  shiftHeld: boolean;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class BoxSelectOverlay {
  private host: SelectionHost;
  private state: BoxSelectState | null = null;
  private active = false;

  private rectDiv: HTMLDivElement | null = null;
  private savedCursor = '';

  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
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

  enter(): boolean {
    if (this.active) return false;
    if (this.host.isAnyModalActive()) return false;

    this.active = true;
    this.state = null;

    // Freeze camera
    this.host.fireDraggingChanged(true);

    // Create overlay rect (hidden until drag starts)
    this.rectDiv = document.createElement('div');
    Object.assign(this.rectDiv.style, {
      position: 'absolute',
      border: '1px dashed #FF9800',
      background: 'rgba(255, 152, 0, 0.1)',
      pointerEvents: 'none',
      zIndex: '9998',
      display: 'none',
    });
    const container = this.host.getCanvas().parentElement;
    container?.appendChild(this.rectDiv);

    // Crosshair cursor
    this.savedCursor = this.host.getCanvas().style.cursor;
    this.host.getCanvas().style.cursor = 'crosshair';

    // Attach listeners (capture phase for modal isolation)
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e);
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundContextMenu = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };

    window.addEventListener('mousedown', this.boundMouseDown, true);
    window.addEventListener('mousemove', this.boundMouseMove, true);
    window.addEventListener('mouseup', this.boundMouseUp, true);
    window.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('contextmenu', this.boundContextMenu, true);

    this.hudCallback?.('Box Select');
    return true;
  }

  cancel(): void {
    if (!this.active) return;
    this.cleanup();
    this.active = false;
    this.state = null;
    this.host.fireDraggingChanged(false);
  }

  // ── Private: event handlers ────────────────────────────────────────────────

  private onMouseDown(e: MouseEvent): void {
    if (!this.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.button === 0) {
      // Left click → start drawing rectangle
      this.state = {
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: true,
        shiftHeld: e.shiftKey,
      };
    } else {
      // Right/middle click → cancel
      this.cancel();
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.active || !this.state?.isDragging) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    this.state.currentX = e.clientX;
    this.state.currentY = e.clientY;
    this.updateRect();
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.active || !this.state?.isDragging) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    this.state.currentX = e.clientX;
    this.state.currentY = e.clientY;

    // Compute selection
    this.performSelection();

    // Exit box select mode
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

  // ── Private: selection logic ───────────────────────────────────────────────

  private performSelection(): void {
    if (!this.state) return;

    const { startX, startY, currentX, currentY, shiftHeld } = this.state;

    // Rectangle bounds (client coords)
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    // Too small → treat as cancel (no selection change)
    if (maxX - minX < 3 && maxY - minY < 3) return;

    const matchedIds: string[] = [];
    const allIds = this.host.getAllIds();

    for (const id of allIds) {
      if (!this.host.isObjectVisible(id)) continue;
      if (this.host.isObjectLocked(id)) continue;

      const obj = this.host.getSelectables().get(id);
      if (!obj) continue;

      const screen = this.projectToScreen(obj);
      if (!screen) continue;

      if (screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY) {
        matchedIds.push(id);
      }
    }

    // Shift → merge with existing selection
    if (shiftHeld) {
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

  // ── Private: overlay rect ─────────────────────────────────────────────────

  private updateRect(): void {
    if (!this.rectDiv || !this.state) return;

    const { startX, startY, currentX, currentY } = this.state;
    const containerRect = this.host.getCanvas().getBoundingClientRect();

    const left = Math.min(startX, currentX) - containerRect.left;
    const top = Math.min(startY, currentY) - containerRect.top;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    Object.assign(this.rectDiv.style, {
      display: 'block',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private cleanup(): void {
    // Remove overlay rect
    if (this.rectDiv) {
      this.rectDiv.parentElement?.removeChild(this.rectDiv);
      this.rectDiv = null;
    }

    // Restore cursor
    this.host.getCanvas().style.cursor = this.savedCursor;

    // Remove listeners
    if (this.boundMouseDown) {
      window.removeEventListener('mousedown', this.boundMouseDown, true);
      this.boundMouseDown = null;
    }
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
