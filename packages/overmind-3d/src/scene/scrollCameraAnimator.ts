import * as THREE from 'three';
import { ScrollGaugeInput } from './scrollGaugeInput.ts';
import type { HoloCardEntry } from './holoScreenShader.ts';

// ── Types ────────────────────────────────────────────────────────────────────

type AnimatorState = 'dwell' | 'playing' | 'free' | 'reading';
type Direction = 'forward' | 'backward';
export type RestPoint = 'A' | 'B' | 'C' | 'D';

interface Segment {
  name: string;
  cameraNode: THREE.PerspectiveCamera;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  duration: number;
}

const SEGMENT_DEFS = [
  { actionName: 'ActionAB', cameraName: 'CameraAB', label: 'AB' },
  { actionName: 'ActionBC', cameraName: 'CameraBC', label: 'BC' },
  { actionName: 'ActionCD', cameraName: 'CameraCD', label: 'CD' },
] as const;

const REST_POINTS: RestPoint[] = ['A', 'B', 'C', 'D'];
const EPS = 0.001;

// Mapping: from a rest point, which segment to play forward
const FORWARD_SEGMENT: Record<RestPoint, number | null> = {
  A: 0, B: 1, C: 2, D: null,
};
// Mapping: from a rest point, which segment to play backward
const BACKWARD_SEGMENT: Record<RestPoint, number | null> = {
  A: null, B: 0, C: 1, D: 2,
};

// Mapping: from a rest point, which card is in focus (null = no card, e.g. point A)
export const POINT_TO_CARD: Record<RestPoint, number | null> = {
  A: null, B: 0, C: 1, D: 2,
};

const READING_SCROLL_SENSITIVITY = 0.0008; // offset (0..1) per pixel of wheel deltaY

// ── Class ────────────────────────────────────────────────────────────────────

export class ScrollCameraAnimator {
  private mainCamera: THREE.PerspectiveCamera;
  private model: THREE.Object3D;
  private segments: Segment[] = [];
  private state: AnimatorState = 'dwell';
  private lastRestPoint: RestPoint = 'A';
  private activeAction: THREE.AnimationAction | null = null;
  private activeDirection: Direction = 'forward';
  private gauge: ScrollGaugeInput;

  // Reading mode
  private cardEntries: HoloCardEntry[] = [];
  private readingCardIdx: number | null = null;
  private textOffsets: number[] = [0, 0, 0];

  // Pre-allocated temps (zero alloc in update loop)
  private tmpMat = new THREE.Matrix4();

  constructor(
    mainCamera: THREE.PerspectiveCamera,
    model: THREE.Object3D,
    animations: THREE.AnimationClip[],
  ) {
    this.mainCamera = mainCamera;
    this.model = model;

    // Build segments by matching cameras and clips by name.
    // Each segment gets its OWN AnimationMixer to avoid time pollution between clips.
    for (const def of SEGMENT_DEFS) {
      const cam = model.getObjectByName(def.cameraName) as THREE.PerspectiveCamera | undefined;
      const clip = THREE.AnimationClip.findByName(animations, def.actionName);

      if (!cam || !clip) {
        console.warn(`[ScrollCameraAnimator] Missing camera or clip:`, {
          camera: def.cameraName, clip: def.actionName, foundCam: !!cam, foundClip: !!clip,
        });
        continue;
      }

      // Normalize clip times to start at 0 (Blender NLA exports preserve absolute timeline times)
      let minTime = Infinity;
      for (const track of clip.tracks) {
        if (track.times.length > 0 && track.times[0] < minTime) {
          minTime = track.times[0];
        }
      }
      let normalizedClip = clip;
      if (minTime > 0 && minTime !== Infinity) {
        const newTracks = clip.tracks.map(track => {
          const newTimes = new Float32Array(track.times.length);
          for (let i = 0; i < track.times.length; i++) {
            newTimes[i] = track.times[i] - minTime;
          }
          const TrackCtor = track.constructor as new (name: string, times: ArrayLike<number>, values: ArrayLike<number>) => THREE.KeyframeTrack;
          return new TrackCtor(track.name, newTimes, track.values);
        });
        normalizedClip = new THREE.AnimationClip(clip.name, -1, newTracks);
      }

      // Dedicated mixer per clip — no time pollution
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(normalizedClip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;

      this.segments.push({
        name: def.label,
        cameraNode: cam,
        mixer,
        action,
        duration: normalizedClip.duration,
      });
      console.log(`[ScrollCameraAnimator] Loaded ${def.label}: duration=${normalizedClip.duration.toFixed(2)}s (offset=${minTime.toFixed(2)}s)`);
    }

    if (this.segments.length === 0) {
      console.warn('[ScrollCameraAnimator] No valid segments found, animator disabled');
    } else {
      // Snap to point A
      this.snapToRestPoint('A');
    }

    // Create input gauge
    this.gauge = new ScrollGaugeInput({
      onForward: () => this.triggerForward(),
      onBackward: () => this.triggerBackward(),
      onTextScroll: (dy) => this.scrollText(dy),
      getState: () => this.state,
      canFwd: () => this.canGoForward(),
      canBack: () => this.canGoBackward(),
    });
  }

  // ── Reading mode ───────────────────────────────────────────────────────

  setCardEntries(entries: HoloCardEntry[]): void {
    this.cardEntries = entries;
  }

  getState(): AnimatorState {
    return this.state;
  }

  getLastRestPoint(): RestPoint {
    return this.lastRestPoint;
  }

  enterReading(cardIdx: number): void {
    if (this.state !== 'dwell') return;
    this.state = 'reading';
    this.readingCardIdx = cardIdx;
    this.gauge.reset();
    this.dispatchReading();
    this.dispatchUpdate();
  }

  exitReading(): void {
    if (this.state !== 'reading') return;
    this.state = 'dwell';
    this.readingCardIdx = null;
    this.dispatchReading();
    this.dispatchUpdate();
  }

  scrollText(deltaY: number): void {
    if (this.state !== 'reading' || this.readingCardIdx === null) return;
    const entry = this.cardEntries[this.readingCardIdx];
    if (!entry) return;
    const viewportFrac = (entry.material.uniforms['uViewportFrac']?.value as number) ?? 0.34;
    const maxOffset = Math.max(0, 1 - viewportFrac);
    const next = Math.max(0, Math.min(maxOffset, this.textOffsets[this.readingCardIdx] + deltaY * READING_SCROLL_SENSITIVITY));
    this.textOffsets[this.readingCardIdx] = next;
    entry.material.uniforms['uTextOffset'].value = next;
    this.dispatchReading();
  }

  setHoverCard(cardIdx: number | null): void {
    for (let i = 0; i < this.cardEntries.length; i++) {
      const target = (cardIdx === this.cardEntries[i].cardIdx) ? 1 : 0;
      this.cardEntries[i].material.uniforms['uHoverGlow'].value = target;
    }
  }

  jumpToPoint(point: RestPoint): void {
    if (this.state === 'reading') {
      this.readingCardIdx = null;
    }
    if (this.activeAction) {
      this.activeAction.paused = true;
      this.activeAction = null;
    }
    this.lastRestPoint = point;
    this.snapToRestPoint(point);
    this.state = 'dwell';
    this.gauge.reset();
    this.dispatchReading();
    this.dispatchUpdate();
  }

  // ── Update (called every frame) ────────────────────────────────────────

  update(delta: number): void {
    if (this.state === 'free') return;
    if (this.state === 'reading') return;

    this.gauge.update(delta);

    if (this.state === 'playing' && this.activeAction) {
      const segment = this.findSegmentByAction(this.activeAction);
      if (segment) {
        segment.mixer.update(delta);

        // Copy source camera transform to main camera
        const source = segment.cameraNode;
        source.updateMatrixWorld(true);
        this.mainCamera.position.setFromMatrixPosition(source.matrixWorld);
        this.tmpMat.extractRotation(source.matrixWorld);
        this.mainCamera.quaternion.setFromRotationMatrix(this.tmpMat);
        if (Math.abs(source.fov - this.mainCamera.fov) > 0.01) {
          this.mainCamera.fov = source.fov;
          this.mainCamera.updateProjectionMatrix();
        }

        // Detect end of clip
        const time = this.activeAction.time;
        if (this.activeDirection === 'forward' && time >= segment.duration - EPS) {
          this.onClipFinished('forward');
        } else if (this.activeDirection === 'backward' && time <= EPS) {
          this.onClipFinished('backward');
        }
      }
    }

    this.dispatchUpdate();
  }

  // ── State transitions ──────────────────────────────────────────────────

  private onClipFinished(dir: Direction): void {
    if (!this.activeAction) return;
    const segment = this.findSegmentByAction(this.activeAction);
    if (!segment) return;

    this.activeAction.paused = true;
    this.activeAction.timeScale = 1;

    // Update rest point: forward AB → B, BC → C, CD → D
    const segmentIdx = this.segments.indexOf(segment);
    if (dir === 'forward') {
      this.lastRestPoint = REST_POINTS[segmentIdx + 1];
    } else {
      this.lastRestPoint = REST_POINTS[segmentIdx];
    }

    this.state = 'dwell';
    this.activeAction = null;
    this.gauge.reset();
  }

  triggerForward(): void {
    if (this.state !== 'dwell') return;
    const idx = FORWARD_SEGMENT[this.lastRestPoint];
    if (idx === null) return;
    const segment = this.segments[idx];
    if (!segment) return;

    segment.action.reset();
    segment.action.timeScale = 1;
    segment.action.time = 0;
    segment.action.paused = false;
    segment.action.play();

    this.activeAction = segment.action;
    this.activeDirection = 'forward';
    this.state = 'playing';
  }

  triggerBackward(): void {
    if (this.state !== 'dwell') return;
    const idx = BACKWARD_SEGMENT[this.lastRestPoint];
    if (idx === null) return;
    const segment = this.segments[idx];
    if (!segment) return;

    segment.action.reset();
    segment.action.timeScale = -1;
    segment.action.time = segment.duration;
    segment.action.paused = false;
    segment.action.play();

    this.activeAction = segment.action;
    this.activeDirection = 'backward';
    this.state = 'playing';
  }

  setFreeMode(active: boolean): void {
    if (active) {
      if (this.state === 'playing' && this.activeAction) {
        this.activeAction.paused = true;
      }
      if (this.state === 'reading') {
        this.readingCardIdx = null;
        this.dispatchReading();
      }
      this.state = 'free';
      this.dispatchUpdate();
    } else {
      this.state = 'dwell';
      this.snapToRestPoint(this.lastRestPoint);
      this.activeAction = null;
      this.gauge.reset();
      this.dispatchUpdate();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Snap main camera to a rest point by evaluating the relevant segment at the right time */
  private snapToRestPoint(point: RestPoint): void {
    if (this.segments.length === 0) return;

    let segment: Segment | undefined;
    let time = 0;

    if (point === 'A') {
      segment = this.segments[0];
      time = 0;
    } else if (point === 'D') {
      segment = this.segments[this.segments.length - 1];
      time = segment.duration;
    } else {
      // B = end of segment 0, C = end of segment 1
      const idx = REST_POINTS.indexOf(point) - 1;
      segment = this.segments[idx];
      time = segment ? segment.duration : 0;
    }

    if (!segment) return;

    // Evaluate the action at the given time
    const action = segment.action;
    action.reset();
    action.paused = true;
    action.time = time;
    action.play();
    segment.mixer.update(0);

    // Copy transform
    const source = segment.cameraNode;
    source.updateMatrixWorld(true);
    this.mainCamera.position.setFromMatrixPosition(source.matrixWorld);
    this.tmpMat.extractRotation(source.matrixWorld);
    this.mainCamera.quaternion.setFromRotationMatrix(this.tmpMat);
    if (Math.abs(source.fov - this.mainCamera.fov) > 0.01) {
      this.mainCamera.fov = source.fov;
      this.mainCamera.updateProjectionMatrix();
    }

    // Stop the action so it doesn't keep ticking
    action.stop();
  }

  private findSegmentByAction(action: THREE.AnimationAction): Segment | undefined {
    return this.segments.find(s => s.action === action);
  }

  canGoForward(): boolean {
    return this.state === 'dwell' && this.lastRestPoint !== 'D' && this.segments.length > 0;
  }

  canGoBackward(): boolean {
    return this.state === 'dwell' && this.lastRestPoint !== 'A' && this.segments.length > 0;
  }

  // ── UI event ───────────────────────────────────────────────────────────

  private dispatchUpdate(): void {
    window.dispatchEvent(new CustomEvent('overmind:scroll-gauge-update', {
      detail: {
        value: this.gauge.getValue(),
        state: this.state,
        currentPoint: this.lastRestPoint,
        canGoForward: this.canGoForward(),
        canGoBackward: this.canGoBackward(),
      },
    }));
  }

  private dispatchReading(): void {
    const idx = this.readingCardIdx;
    const entry = idx !== null ? this.cardEntries[idx] : null;
    const viewportFrac = entry ? (entry.material.uniforms['uViewportFrac']?.value as number) : 0;
    const offset = idx !== null ? this.textOffsets[idx] : 0;
    window.dispatchEvent(new CustomEvent('overmind:reading-mode', {
      detail: {
        active: this.state === 'reading',
        cardIdx: idx,
        offset,
        viewportFrac,
      },
    }));
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  dispose(): void {
    this.gauge.dispose();
    for (const seg of this.segments) {
      seg.mixer.stopAllAction();
      seg.mixer.uncacheRoot(this.model);
    }
    this.segments = [];
    this.activeAction = null;
  }
}
