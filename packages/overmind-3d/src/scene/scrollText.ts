import * as THREE from 'three';
import { Text } from 'troika-three-text';
import type { TextElementLayout } from '../machines/timelineMachine.ts';

export interface ScrollTextContext {
  scrollProgress: number;
  titleText: string;
  titleFontSize: number;
  titleColor: string;
  titleEmissiveIntensity: number;
  subtitleText: string;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleEmissiveIntensity: number;
  titleLayout: TextElementLayout;
  subtitleLayout: TextElementLayout;
  visible: boolean;
}
import { applyEasing } from '../utils/easing.ts';

interface ElementState {
  x: number; y: number; z: number;
  opacity: number;
}

function computeElementState(layout: TextElementLayout, progress: number): ElementState {
  // Phase 1: Before entrance
  if (progress <= layout.scrollStart) {
    return { x: layout.startX, y: layout.startY, z: layout.startZ, opacity: 0 };
  }

  // Phase 2: Entrance (start → end)
  if (progress < layout.scrollEnd) {
    const range = layout.scrollEnd - layout.scrollStart;
    const tRaw = range > 0 ? (progress - layout.scrollStart) / range : 1;
    const t = applyEasing(layout.easing, tRaw);
    return {
      x: THREE.MathUtils.lerp(layout.startX, layout.endX, t),
      y: THREE.MathUtils.lerp(layout.startY, layout.endY, t),
      z: THREE.MathUtils.lerp(layout.startZ, layout.endZ, t),
      opacity: t,
    };
  }

  // Phase 3: Steady (hold at end position)
  if (progress < layout.exitStart) {
    return { x: layout.endX, y: layout.endY, z: layout.endZ, opacity: 1 };
  }

  // Phase 4: Exit (end → exit)
  if (progress < layout.exitEnd) {
    const range = layout.exitEnd - layout.exitStart;
    const tRaw = range > 0 ? (progress - layout.exitStart) / range : 1;
    const t = applyEasing(layout.exitEasing, tRaw);
    return {
      x: THREE.MathUtils.lerp(layout.endX, layout.exitX, t),
      y: THREE.MathUtils.lerp(layout.endY, layout.exitY, t),
      z: THREE.MathUtils.lerp(layout.endZ, layout.exitZ, t),
      opacity: 1 - t,
    };
  }

  // Phase 5: After exit
  return { x: layout.exitX, y: layout.exitY, z: layout.exitZ, opacity: 0 };
}

export class ScrollTextSystem {
  private titleMesh: InstanceType<typeof Text>;
  private subtitleMesh: InstanceType<typeof Text>;
  private group: THREE.Group;
  private camera: THREE.Camera;

  // Animation state
  private currentProgress = 0;
  private targetProgress = 0;

  // Cached layouts
  private titleLayout!: TextElementLayout;
  private subtitleLayout!: TextElementLayout;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    titleFontUrl: string,
    subtitleFontUrl: string,
    initialContext: ScrollTextContext,
  ) {
    this.camera = camera;
    this.group = new THREE.Group();

    // Title mesh
    this.titleMesh = new Text();
    this.titleMesh.text = initialContext.titleText;
    this.titleMesh.font = titleFontUrl;
    this.titleMesh.fontSize = initialContext.titleFontSize;
    this.titleMesh.anchorX = 'center';
    this.titleMesh.anchorY = 'middle';
    this.titleMesh.textAlign = 'center';
    // HDR color for bloom interaction (values > 1.0 exceed bloom threshold)
    this.titleMesh.color = new THREE.Color(initialContext.titleColor)
      .multiplyScalar(initialContext.titleEmissiveIntensity);
    this.titleMesh.userData.selectableId = 'title';
    this.titleMesh.sync();
    this.group.add(this.titleMesh);

    // Subtitle mesh
    this.subtitleMesh = new Text();
    this.subtitleMesh.text = initialContext.subtitleText;
    this.subtitleMesh.font = subtitleFontUrl;
    this.subtitleMesh.fontSize = initialContext.subtitleFontSize;
    this.subtitleMesh.anchorX = 'left';
    this.subtitleMesh.anchorY = 'top';
    this.subtitleMesh.textAlign = 'left';
    this.subtitleMesh.maxWidth = 8;
    this.subtitleMesh.color = new THREE.Color(initialContext.subtitleColor)
      .multiplyScalar(initialContext.subtitleEmissiveIntensity);
    this.subtitleMesh.userData.selectableId = 'subtitle';
    this.subtitleMesh.sync();
    this.group.add(this.subtitleMesh);

    scene.add(this.group);
    this.syncFromState(initialContext);
  }

  /**
   * Called each frame. Smoothly interpolates scroll progress and updates positions.
   */
  update(delta: number): void {
    // Smooth lerp toward target scroll (avoids jerky scroll events)
    const lerpSpeed = 1 - Math.pow(0.001, delta);
    this.currentProgress = THREE.MathUtils.lerp(
      this.currentProgress,
      this.targetProgress,
      lerpSpeed,
    );

    // Compute per-element state
    const titleState = computeElementState(this.titleLayout, this.currentProgress);
    const subtitleState = computeElementState(this.subtitleLayout, this.currentProgress);

    // Apply title position + opacity
    this.titleMesh.position.set(titleState.x, titleState.y, titleState.z);
    if (this.titleMesh.material && 'opacity' in this.titleMesh.material) {
      (this.titleMesh.material as THREE.Material).opacity = titleState.opacity;
      (this.titleMesh.material as THREE.Material).transparent = titleState.opacity < 1;
    }

    // Apply subtitle position + opacity
    this.subtitleMesh.position.set(subtitleState.x, subtitleState.y, subtitleState.z);
    if (this.subtitleMesh.material && 'opacity' in this.subtitleMesh.material) {
      (this.subtitleMesh.material as THREE.Material).opacity = subtitleState.opacity;
      (this.subtitleMesh.material as THREE.Material).transparent = subtitleState.opacity < 1;
    }

    // Billboard: text always faces camera
    this.titleMesh.quaternion.copy(this.camera.quaternion);
    this.subtitleMesh.quaternion.copy(this.camera.quaternion);
  }

  syncFromState(ctx: ScrollTextContext): void {
    this.targetProgress = ctx.scrollProgress;
    this.titleLayout = ctx.titleLayout;
    this.subtitleLayout = ctx.subtitleLayout;
    this.group.visible = ctx.visible;

    // Update text content if changed
    if (this.titleMesh.text !== ctx.titleText) {
      this.titleMesh.text = ctx.titleText;
      this.titleMesh.sync();
    }
    if (this.subtitleMesh.text !== ctx.subtitleText) {
      this.subtitleMesh.text = ctx.subtitleText;
      this.subtitleMesh.sync();
    }

    // Update font sizes
    if (this.titleMesh.fontSize !== ctx.titleFontSize) {
      this.titleMesh.fontSize = ctx.titleFontSize;
      this.titleMesh.sync();
    }
    if (this.subtitleMesh.fontSize !== ctx.subtitleFontSize) {
      this.subtitleMesh.fontSize = ctx.subtitleFontSize;
      this.subtitleMesh.sync();
    }

    // Update colors (HDR for bloom)
    this.titleMesh.color = new THREE.Color(ctx.titleColor)
      .multiplyScalar(ctx.titleEmissiveIntensity);
    this.subtitleMesh.color = new THREE.Color(ctx.subtitleColor)
      .multiplyScalar(ctx.subtitleEmissiveIntensity);
  }

  getSelectableObjects(): THREE.Object3D[] {
    return [this.titleMesh, this.subtitleMesh].filter(Boolean);
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getTitleMesh(): THREE.Object3D { return this.titleMesh; }
  getSubtitleMesh(): THREE.Object3D { return this.subtitleMesh; }

  dispose(): void {
    this.titleMesh.dispose();
    this.subtitleMesh.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
