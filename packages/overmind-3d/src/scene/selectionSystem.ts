import * as THREE from 'three';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ModalRotateModal } from './ModalRotateModal.ts';
import { CustomScaleModal } from './CustomScaleModal.ts';
import { ModalGrabModal } from './ModalGrabModal.ts';
import { ModalMirrorModal } from './ModalMirrorModal.ts';
import { BoxSelectOverlay } from './BoxSelectOverlay.ts';
import { LassoSelectOverlay } from './LassoSelectOverlay.ts';

const CLICK_THRESHOLD = 3; // px — below this, mousedown→mouseup is a click

export interface TransformData {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export type ObjectChangeCallback = (id: string, data: TransformData) => void;
export type MultiObjectChangeCallback = (changes: Array<{ id: string; data: TransformData }>) => void;
export type SelectionChangeCallback = (primaryId: string | null, selectedIds: string[]) => void;

// ── Host interface for modal composition ─────────────────────────────────────

export interface SelectionHost {
  getSelectedId(): string | null;
  getSelectedIds(): string[];
  getSelectables(): Map<string, THREE.Object3D>;
  getCamera(): THREE.PerspectiveCamera;
  getCanvas(): HTMLCanvasElement;
  getScene(): THREE.Scene;
  computeMultiPivot(): THREE.Vector3;
  saveMultiInitialTransforms(): void;
  broadcastMultiChanges(): void;
  getMultiInitialTransforms(): Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number }>;
  getMultiPivot(): THREE.Vector3;
  fireObjectChange(id: string, data: TransformData): void;
  fireDraggingChanged(dragging: boolean): void;
  detachGizmo(): void;
  isAnyModalActive(): boolean;
  restoreSelection(ids: string[]): void;
  isObjectVisible(id: string): boolean;
  isObjectLocked(id: string): boolean;
  getAllIds(): string[];
  getSelectedIds(): string[];
}

// ── SelectionSystem ──────────────────────────────────────────────────────────

export class SelectionSystem implements SelectionHost {
  private raycaster = new THREE.Raycaster();
  private selectables = new Map<string, THREE.Object3D>();
  private selectedId: string | null = null;
  private selectedIds = new Set<string>();
  private lockedIds = new Set<string>();
  private camera: THREE.PerspectiveCamera;
  private outlinePass: OutlinePass;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;

  // Click detection
  private mouseDownPos = { x: 0, y: 0 };
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;

  // TransformControls (gizmo)
  private transformControls: TransformControls;
  private _isDragging = false;
  private changeCallback: ObjectChangeCallback | null = null;
  /** Additional change listeners (e.g. curve editor) — never replace changeCallback */
  private changeListeners = new Set<ObjectChangeCallback>();
  private multiChangeCallback: MultiObjectChangeCallback | null = null;
  private selectionChangeCallback: SelectionChangeCallback | null = null;
  private draggingChangedCallback: ((dragging: boolean) => void) | null = null;
  private rotationHudCallback: ((rotation: THREE.Euler | null) => void) | null = null;

  // Multi-select delta tracking
  private lastPrimaryPosition = new THREE.Vector3();
  private lastPrimaryQuat = new THREE.Quaternion();
  private lastPrimaryScale = 1;
  private multiPivot = new THREE.Vector3();
  private multiInitialTransforms = new Map<string, {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: number;
  }>();

  // Modal delegates
  private rotateModal: ModalRotateModal;
  private scaleModal: CustomScaleModal;
  private grabModal: ModalGrabModal;
  private mirrorModal: ModalMirrorModal;
  private boxSelectOverlay: BoxSelectOverlay;
  private lassoSelectOverlay: LassoSelectOverlay;

  // Curve edit mode
  private curveEditMode = false;
  private curveEditRefPoint = new THREE.Vector3(0, 1.5, 0);
  private onEmptyClickCb: ((pos: THREE.Vector3) => void) | null = null;

  // Priority pick : quand non-null, un clic ne teste QUE ces ids (poignées d'édition
  // dans/derrière une géométrie, ex. éditeur de zone du profil). Les ignore le z-buffer.
  private priorityPickIds: Set<string> | null = null;

  // Target pick mode (Track To constraint)
  private targetPickMode = false;
  private onTargetPickCb: ((id: string | null) => void) | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    outlinePass: OutlinePass,
    scene: THREE.Scene,
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.outlinePass = outlinePass;
    this.scene = scene;

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);

    canvas.addEventListener('mousedown', this.boundMouseDown);
    canvas.addEventListener('mouseup', this.boundMouseUp);

    // TransformControls setup
    this.transformControls = new TransformControls(camera, canvas);
    this.transformControls.setMode('translate');
    scene.add(this.transformControls.getHelper());

    this.transformControls.addEventListener('dragging-changed', (event: { value: unknown }) => {
      this._isDragging = !!event.value;
      // Capture primary transforms at drag start for multi-select delta calculation
      if (event.value && this.selectedId && this.selectedIds.size > 1) {
        const primaryObj = this.selectables.get(this.selectedId);
        if (primaryObj) {
          this.lastPrimaryPosition.copy(primaryObj.position);
          this.lastPrimaryQuat.copy(primaryObj.quaternion);
          this.lastPrimaryScale = primaryObj.scale.x;
          this.multiPivot.copy(this.computeMultiPivot());
          this.saveMultiInitialTransforms();
        }
      }
      this.draggingChangedCallback?.(this._isDragging);
      if (!event.value) this.rotationHudCallback?.(null);
    });

    this.transformControls.addEventListener('objectChange', () => {
      if ((!this.changeCallback && this.changeListeners.size === 0) || !this.selectedId) return;
      const obj = this.selectables.get(this.selectedId);
      if (!obj) return;

      // Force uniform scale: use the axis that changed most from 1.0
      if (this.transformControls.mode === 'scale') {
        const maxDelta = [obj.scale.x, obj.scale.y, obj.scale.z]
          .reduce((best, v) => Math.abs(v - 1) > Math.abs(best - 1) ? v : best, 1);
        obj.scale.setScalar(maxDelta);
      }

      // Multi-select: propagate translation delta to non-primary objects
      if (this.selectedIds.size > 1 && this.transformControls.mode === 'translate') {
        const delta = obj.position.clone().sub(this.lastPrimaryPosition);
        for (const id of this.selectedIds) {
          if (id === this.selectedId) continue;
          const other = this.selectables.get(id);
          if (other) other.position.add(delta);
        }
        this.lastPrimaryPosition.copy(obj.position);
        this.broadcastMultiChanges();
      }

      // Multi-select: propagate rotation delta around pivot to non-primary objects
      if (this.selectedIds.size > 1 && this.transformControls.mode === 'rotate') {
        const deltaQuat = obj.quaternion.clone().multiply(this.lastPrimaryQuat.clone().invert());
        for (const id of this.selectedIds) {
          if (id === this.selectedId) continue;
          const other = this.selectables.get(id);
          if (!other) continue;
          // Rotate position around pivot
          const offset = other.position.clone().sub(this.multiPivot);
          offset.applyQuaternion(deltaQuat);
          other.position.copy(this.multiPivot).add(offset);
          // Rotate object orientation
          other.quaternion.premultiply(deltaQuat);
        }
        this.lastPrimaryQuat.copy(obj.quaternion);
        this.broadcastMultiChanges();
      }

      // Multi-select: propagate scale ratio around pivot to non-primary objects
      if (this.selectedIds.size > 1 && this.transformControls.mode === 'scale') {
        const scaleRatio = obj.scale.x / this.lastPrimaryScale;
        if (scaleRatio !== 1 && isFinite(scaleRatio)) {
          for (const id of this.selectedIds) {
            if (id === this.selectedId) continue;
            const other = this.selectables.get(id);
            if (!other) continue;
            // Scale position relative to pivot
            const offset = other.position.clone().sub(this.multiPivot);
            offset.multiplyScalar(scaleRatio);
            other.position.copy(this.multiPivot).add(offset);
            // Scale object
            other.scale.multiplyScalar(scaleRatio);
          }
          this.lastPrimaryScale = obj.scale.x;
          this.broadcastMultiChanges();
        }
      }

      const changeData = {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone(),
      };
      this.changeCallback?.(this.selectedId, changeData);
      for (const listener of this.changeListeners) listener(this.selectedId, changeData);

      // Broadcast rotation during rotate drag for HUD
      if (this.transformControls.mode === 'rotate' && this.rotationHudCallback) {
        this.rotationHudCallback(obj.rotation.clone());
      }
    });

    // Initialize modal delegates (must be last — they reference `this`)
    this.rotateModal = new ModalRotateModal(this);
    this.scaleModal = new CustomScaleModal(this);
    this.grabModal = new ModalGrabModal(this);
    this.mirrorModal = new ModalMirrorModal(this);
    this.boxSelectOverlay = new BoxSelectOverlay(this);
    this.lassoSelectOverlay = new LassoSelectOverlay(this);
    this.lassoSelectOverlay.attach();
  }

  // ── SelectionHost implementation ───────────────────────────────────────────

  getSelectables(): Map<string, THREE.Object3D> { return this.selectables; }
  getCamera(): THREE.PerspectiveCamera { return this.camera; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getScene(): THREE.Scene { return this.scene; }
  getMultiInitialTransforms(): Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number }> { return this.multiInitialTransforms; }
  getMultiPivot(): THREE.Vector3 { return this.multiPivot; }
  fireObjectChange(id: string, data: TransformData): void {
    this.changeCallback?.(id, data);
    for (const listener of this.changeListeners) listener(id, data);
  }
  fireDraggingChanged(dragging: boolean): void { this.draggingChangedCallback?.(dragging); }
  isAnyModalActive(): boolean { return this.rotateModal.isActive() || this.scaleModal.isActive() || this.grabModal.isActive() || this.mirrorModal.isActive() || this.boxSelectOverlay.isActive() || this.lassoSelectOverlay.isActive(); }

  // ── Multi-select helpers (public for modal access) ─────────────────────────

  /** Compute the barycentre of all selected objects (also stores in multiPivot) */
  computeMultiPivot(): THREE.Vector3 {
    const pivot = new THREE.Vector3();
    let count = 0;
    for (const id of this.selectedIds) {
      const obj = this.selectables.get(id);
      if (obj) { pivot.add(obj.position); count++; }
    }
    if (count > 0) pivot.divideScalar(count);
    this.multiPivot.copy(pivot);
    return pivot;
  }

  /** Save transforms of all non-primary objects (for cancel/restore) */
  saveMultiInitialTransforms(): void {
    this.multiInitialTransforms.clear();
    for (const id of this.selectedIds) {
      if (id === this.selectedId) continue;
      const obj = this.selectables.get(id);
      if (obj) {
        this.multiInitialTransforms.set(id, {
          position: obj.position.clone(),
          quaternion: obj.quaternion.clone(),
          scale: obj.scale.x,
        });
      }
    }
  }

  /** Broadcast transform changes for all non-primary selected objects */
  broadcastMultiChanges(): void {
    if (!this.multiChangeCallback || this.selectedIds.size <= 1) return;
    const changes: Array<{ id: string; data: TransformData }> = [];
    for (const id of this.selectedIds) {
      if (id === this.selectedId) continue;
      const obj = this.selectables.get(id);
      if (obj) {
        changes.push({ id, data: {
          position: obj.position.clone(),
          rotation: obj.rotation.clone(),
          scale: obj.scale.clone(),
        }});
      }
    }
    this.multiChangeCallback(changes);
  }

  // ── Registry ───────────────────────────────────────────────────────────────

  register(id: string, obj: THREE.Object3D): void {
    this.selectables.set(id, obj);
  }

  unregister(id: string): void {
    this.selectables.delete(id);
    this.selectedIds.delete(id);
    if (this.selectedId === id) {
      const ids = Array.from(this.selectedIds);
      this.selectedId = ids.length > 0 ? ids[ids.length - 1] : null;
    }
    if (this.selectedIds.size === 0) {
      this.deselect();
    } else {
      this.updateOutline();
    }
  }

  getAllIds(): string[] {
    return Array.from(this.selectables.keys());
  }

  getObjectById(id: string): THREE.Object3D | null {
    return this.selectables.get(id) ?? null;
  }

  // ── Visibility ─────────────────────────────────────────────────────────────

  setObjectVisible(id: string, visible: boolean): void {
    const obj = this.selectables.get(id);
    if (!obj) return;
    obj.visible = visible;
    if (!visible) {
      this.selectedIds.delete(id);
      if (this.selectedId === id) {
        const ids = Array.from(this.selectedIds);
        this.selectedId = ids.length > 0 ? ids[ids.length - 1] : null;
      }
      if (this.selectedIds.size === 0) {
        this.deselect();
      } else {
        this.updateOutline();
      }
    }
  }

  isObjectVisible(id: string): boolean {
    const obj = this.selectables.get(id);
    return obj ? obj.visible : false;
  }

  setObjectLocked(id: string, locked: boolean): void {
    if (locked) {
      this.lockedIds.add(id);
      // Auto-deselect if locked and selected
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
        if (this.selectedId === id) {
          const ids = Array.from(this.selectedIds);
          this.selectedId = ids.length > 0 ? ids[ids.length - 1] : null;
        }
        if (this.selectedIds.size === 0) {
          this.deselect();
        } else {
          this.updateOutline();
        }
      }
    } else {
      this.lockedIds.delete(id);
    }
  }

  isObjectLocked(id: string): boolean {
    return this.lockedIds.has(id);
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  getSelectedId(): string | null {
    return this.selectedId;
  }

  getSelectedObject(): THREE.Object3D | null {
    if (!this.selectedId) return null;
    return this.selectables.get(this.selectedId) ?? null;
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  getSelectedCount(): number {
    return this.selectedIds.size;
  }

  select(id: string): void {
    const obj = this.selectables.get(id);
    if (!obj) return;
    this.detachGizmo();
    this.selectedId = id;
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.updateOutline();
    this.selectionChangeCallback?.(id, [id]);
  }

  toggleSelect(id: string): void {
    const obj = this.selectables.get(id);
    if (!obj) return;
    this.detachGizmo();
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      if (this.selectedId === id) {
        const ids = Array.from(this.selectedIds);
        this.selectedId = ids.length > 0 ? ids[ids.length - 1] : null;
      }
    } else {
      this.selectedIds.add(id);
      this.selectedId = id;
    }
    this.updateOutline();
    this.selectionChangeCallback?.(this.selectedId, Array.from(this.selectedIds));
  }

  deselect(): void {
    this.detachGizmo();
    this.selectedId = null;
    this.selectedIds.clear();
    this.updateOutline();
    this.selectionChangeCallback?.(null, []);
  }

  /** Restore selection from undo/redo snapshot */
  restoreSelection(ids: string[]): void {
    this.detachGizmo();
    this.selectedIds.clear();
    this.selectedId = null;
    for (const id of ids) {
      if (this.selectables.has(id)) {
        this.selectedIds.add(id);
        this.selectedId = id;
      }
    }
    this.updateOutline();
  }

  /** Select all visible, unlocked objects */
  selectAll(): void {
    const ids = this.getAllIds().filter(id => this.isObjectVisible(id) && !this.isObjectLocked(id));
    if (ids.length === 0) return;
    this.restoreSelection(ids);
  }

  /** Raycast from arbitrary client coordinates (for CSS3D overlay click passthrough) */
  trySelectAt(clientX: number, clientY: number, ctrlKey = false): void {
    this.handleClick(clientX, clientY, ctrlKey);
  }

  // ── Outline ────────────────────────────────────────────────────────────────

  private updateOutline(): void {
    const objects: THREE.Object3D[] = [];
    for (const id of this.selectedIds) {
      const obj = this.selectables.get(id);
      if (obj) objects.push(obj);
    }
    this.outlinePass.selectedObjects = objects;
  }

  // ── Gizmo (TransformControls) ──────────────────────────────────────────────

  attachGizmo(): void {
    if (!this.selectedId) return;
    const obj = this.selectables.get(this.selectedId);
    if (!obj) return;
    this.transformControls.attach(obj);
  }

  detachGizmo(): void {
    this.transformControls.detach();
  }

  isDragging(): boolean {
    return this._isDragging;
  }

  isGizmoAttached(): boolean {
    return this.transformControls.object !== undefined;
  }

  setMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.transformControls.setMode(mode);
  }

  getMode(): string {
    return this.transformControls.mode;
  }

  setRotationSnap(angle: number | null): void {
    this.transformControls.setRotationSnap(angle);
  }

  onObjectChange(callback: ObjectChangeCallback): void {
    this.changeCallback = callback;
  }

  /** Add an EXTRA change listener without replacing the main callback (gizmoBridge). */
  addObjectChangeListener(callback: ObjectChangeCallback): void {
    this.changeListeners.add(callback);
  }

  removeObjectChangeListener(callback: ObjectChangeCallback): void {
    this.changeListeners.delete(callback);
  }

  onMultiObjectChange(callback: MultiObjectChangeCallback): void {
    this.multiChangeCallback = callback;
  }

  onSelectionChange(callback: SelectionChangeCallback): void {
    this.selectionChangeCallback = callback;
  }

  onDraggingChanged(callback: (dragging: boolean) => void): void {
    this.draggingChangedCallback = callback;
  }

  onRotationHud(callback: (rotation: THREE.Euler | null) => void): void {
    this.rotationHudCallback = callback;
  }

  // ── Modal rotate (delegated to ModalRotateModal) ────────────────────────────

  isRotating(): boolean {
    return this.rotateModal.isActive();
  }

  enterRotate(camera: THREE.PerspectiveCamera): boolean {
    return this.rotateModal.enter(camera);
  }

  confirmRotate(): void {
    this.rotateModal.confirm();
  }

  cancelRotate(): void {
    this.rotateModal.cancel();
  }

  onRotateHud(callback: (text: string | null) => void): void {
    this.rotateModal.setHudCallback(callback);
  }

  // ── Custom scale (delegated to CustomScaleModal) ───────────────────────────

  isCustomScaling(): boolean {
    return this.scaleModal.isActive();
  }

  enterCustomScale(): boolean {
    return this.scaleModal.enter();
  }

  confirmCustomScale(): void {
    this.scaleModal.confirm();
  }

  cancelCustomScale(): void {
    this.scaleModal.cancel();
  }

  // ── Modal grab (delegated to ModalGrabModal) ────────────────────────────────

  isGrabbing(): boolean {
    return this.grabModal.isActive();
  }

  enterGrab(camera: THREE.PerspectiveCamera): boolean {
    return this.grabModal.enter(camera);
  }

  confirmGrab(): void {
    this.grabModal.confirm();
  }

  cancelGrab(): void {
    this.grabModal.cancel();
  }

  onGrabHud(callback: (text: string | null) => void): void {
    this.grabModal.setHudCallback(callback);
  }

  // ── Modal mirror (delegated to ModalMirrorModal) ──────────────────────────

  isMirroring(): boolean {
    return this.mirrorModal.isActive();
  }

  enterMirror(): boolean {
    return this.mirrorModal.enter();
  }

  confirmMirror(): void {
    this.mirrorModal.confirm();
  }

  cancelMirror(): void {
    this.mirrorModal.cancel();
  }

  onMirrorHud(callback: (text: string | null) => void): void {
    this.mirrorModal.setHudCallback(callback);
  }

  // ── Box select (delegated to BoxSelectOverlay) ────────────────────────────

  isBoxSelecting(): boolean {
    return this.boxSelectOverlay.isActive();
  }

  enterBoxSelect(): boolean {
    return this.boxSelectOverlay.enter();
  }

  cancelBoxSelect(): void {
    this.boxSelectOverlay.cancel();
  }

  onBoxSelectHud(callback: (text: string | null) => void): void {
    this.boxSelectOverlay.setHudCallback(callback);
  }

  // ── Lasso select (delegated to LassoSelectOverlay) ──────────────────────

  isLassoSelecting(): boolean {
    return this.lassoSelectOverlay.isActive();
  }

  cancelLassoSelect(): void {
    this.lassoSelectOverlay.cancel();
  }

  onLassoSelectHud(callback: (text: string | null) => void): void {
    this.lassoSelectOverlay.setHudCallback(callback);
  }

  // ── Curve edit mode ─────────────────────────────────────────────────────────

  setCurveEditMode(active: boolean): void {
    this.curveEditMode = active;
  }

  /** Restreint le pick au clic à ces ids (ex. poignées d'édition derrière une coque).
   *  null = comportement normal. */
  setPriorityPick(ids: string[] | null): void {
    this.priorityPickIds = ids && ids.length > 0 ? new Set(ids) : null;
  }

  isCurveEditMode(): boolean {
    return this.curveEditMode;
  }

  setCurveEditReferencePoint(point: THREE.Vector3): void {
    this.curveEditRefPoint.copy(point);
  }

  onEmptyClick(cb: (pos: THREE.Vector3) => void): void {
    this.onEmptyClickCb = cb;
  }

  // ── Target pick mode (Track To) ──────────────────────────────────────────

  setTargetPickMode(active: boolean): void {
    this.targetPickMode = active;
  }

  isTargetPickMode(): boolean {
    return this.targetPickMode;
  }

  onTargetPick(cb: (id: string | null) => void): void {
    this.onTargetPickCb = cb;
  }

  // ── Click detection ────────────────────────────────────────────────────────

  private onMouseDown(e: MouseEvent): void {
    this.mouseDownPos.x = e.clientX;
    this.mouseDownPos.y = e.clientY;
  }

  private onMouseUp(e: MouseEvent): void {
    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) >= CLICK_THRESHOLD) return; // drag, not click

    this.handleClick(e.clientX, e.clientY, e.ctrlKey);
  }

  private handleClick(clientX: number, clientY: number, ctrlKey = false): void {
    // Convert to NDC
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(ndc, this.camera);

    // Pick prioritaire : ne teste QUE les ids prioritaires (poignées d'édition), en
    // ignorant la profondeur des autres meshes (ex. poignées DANS la coque du vaisseau).
    if (this.priorityPickIds) {
      const prio = Array.from(this.priorityPickIds)
        .map((id) => this.selectables.get(id))
        .filter((o): o is THREE.Object3D => !!o);
      const prioHits = this.raycaster.intersectObjects(prio, true);
      for (const hit of prioHits) {
        const id = this.findSelectableId(hit.object);
        if (id && this.priorityPickIds.has(id)) {
          if (ctrlKey) this.toggleSelect(id); else this.select(id);
          return;
        }
      }
      this.deselect(); // clic hors poignée → on relâche (ne sélectionne jamais la coque)
      return;
    }

    const objects = Array.from(this.selectables.values());
    const intersections = this.raycaster.intersectObjects(objects, true);

    // Target pick mode (Track To): intercept click to pick a target object
    if (this.targetPickMode && this.onTargetPickCb) {
      for (const hit of intersections) {
        const id = this.findSelectableId(hit.object);
        if (id) {
          this.onTargetPickCb(id);
          this.targetPickMode = false;
          return;
        }
      }
      // Click on empty space → cancel
      this.onTargetPickCb(null);
      this.targetPickMode = false;
      return;
    }

    for (const hit of intersections) {
      const id = this.findSelectableId(hit.object);
      if (id) {
        // Skip invisible or locked objects
        const registeredObj = this.selectables.get(id);
        if (registeredObj && !registeredObj.visible) continue;
        if (this.lockedIds.has(id)) continue;
        if (ctrlKey) {
          this.toggleSelect(id);
        } else {
          this.select(id);
        }
        return;
      }
    }

    // Nothing hit
    if (this.curveEditMode && this.onEmptyClickCb) {
      const camDir = this.camera.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, this.curveEditRefPoint);
      const hitPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, hitPoint)) {
        this.onEmptyClickCb(hitPoint);
      }
      return;
    }
    this.deselect();
  }

  /** Walk up the parent chain to find the nearest object with a selectableId */
  private findSelectableId(obj: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = obj;
    while (current) {
      const id = current.userData.selectableId as string | undefined;
      if (id && this.selectables.has(id)) return id;
      current = current.parent;
    }
    return null;
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.rotateModal.isActive()) this.rotateModal.cancel();
    if (this.scaleModal.isActive()) this.scaleModal.cancel();
    if (this.grabModal.isActive()) this.grabModal.cancel();
    if (this.mirrorModal.isActive()) this.mirrorModal.cancel();
    if (this.boxSelectOverlay.isActive()) this.boxSelectOverlay.cancel();
    this.lassoSelectOverlay.dispose();
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.detachGizmo();
    this.scene.remove(this.transformControls.getHelper());
    this.transformControls.dispose();
    this.selectables.clear();
    this.selectedId = null;
    this.selectedIds.clear();
    this.outlinePass.selectedObjects = [];
  }
}
