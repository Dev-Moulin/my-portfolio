import * as THREE from 'three';
import { NeonBandsSystem } from './neonBands.ts';
import { ScrollTextSystem } from './scrollText.ts';
import { CameraKeyframeSystem } from './cameraKeyframes.ts';
import { getFontPath } from '../utils/dracoPath.ts';
import type { SelectionSystem } from './selectionSystem.ts';
import type { SoftBoundaryBehavior } from '../systems/SoftBoundaryBehavior.ts';
import type { SceneActors, SceneMutableState } from './sceneContext.ts';
import type { ModelSettings } from './types.ts';
import type { NeonBandsContext } from '../machines/neonBandsMachine.ts';
import type { TimelineContext } from '../machines/timelineMachine.ts';

export interface TimelineBridgeResult {
  neonBands: NeonBandsSystem | null;
  neonSub: { unsubscribe: () => void } | undefined;
  scrollText: ScrollTextSystem | null;
  camKeyframes: CameraKeyframeSystem | null;
  timelineSub: { unsubscribe: () => void } | undefined;
}

function buildScrollTextBridge(ctx: TimelineContext) {
  return {
    scrollProgress: ctx.currentFrame,
    titleText: ctx.titleText,
    titleFontSize: ctx.titleFontSize,
    titleColor: ctx.titleColor,
    titleEmissiveIntensity: ctx.titleEmissiveIntensity,
    subtitleText: ctx.subtitleText,
    subtitleFontSize: ctx.subtitleFontSize,
    subtitleColor: ctx.subtitleColor,
    subtitleEmissiveIntensity: ctx.subtitleEmissiveIntensity,
    titleLayout: ctx.titleLayout,
    subtitleLayout: ctx.subtitleLayout,
    visible: ctx.textVisible,
  };
}

export function setupTimelineBridge(
  actors: SceneActors,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  selection: SelectionSystem,
  basePath: string,
  state: SceneMutableState,
  modelSettingsRef: { current: ModelSettings },
  boundaryBehavior: SoftBoundaryBehavior,
): TimelineBridgeResult {
  const { neonBandsActor, timelineActor, selectionActor, bloomActor, lightingActor, materialActor, sceneActor } = actors;

  // Neon bands backdrop
  let neonBands: NeonBandsSystem | null = null;
  let neonSub: { unsubscribe: () => void } | undefined;
  if (neonBandsActor) {
    const neonState = neonBandsActor.getSnapshot();
    const ctx = neonState.context;
    neonBands = new NeonBandsSystem(scene, ctx);
    selection.register('neon', neonBands.getGroup());
    selectionActor?.send({ type: 'REGISTER_ID', id: 'neon' });
    neonSub = neonBandsActor.subscribe((snapshot: { context: NeonBandsContext }) => {
      const c = snapshot.context;
      neonBands?.syncFromState(c);
    });
  }

  // Scroll text + Camera keyframes (from unified timelineActor)
  let scrollText: ScrollTextSystem | null = null;
  let camKeyframes: CameraKeyframeSystem | null = null;
  let timelineSub: { unsubscribe: () => void } | undefined;

  if (timelineActor) {
    const ctx = timelineActor.getSnapshot().context;

    scrollText = new ScrollTextSystem(
      scene,
      camera,
      getFontPath(basePath, 'Cynatar.otf'),
      getFontPath(basePath, 'SF-TransRobotics.ttf'),
      buildScrollTextBridge(ctx),
    );
    for (const obj of scrollText.getSelectableObjects()) {
      const id = obj.userData.selectableId as string;
      if (id) {
        selection.register(id, obj);
        selectionActor?.send({ type: 'REGISTER_ID', id });
      }
    }

    camKeyframes = new CameraKeyframeSystem(camera, {
      keyframes: ctx.cameraKeyframes,
      scrollProgress: ctx.currentFrame,
      enabled: ctx.cameraEnabled,
    });

    // Single subscription for both systems + visual keyframe bridge
    timelineSub = timelineActor.subscribe((snapshot) => {
      const c = snapshot.context;
      scrollText?.syncFromState(buildScrollTextBridge(c));
      camKeyframes?.syncFromState({
        keyframes: c.cameraKeyframes,
        scrollProgress: c.currentFrame,
        enabled: c.cameraEnabled,
      });

      // Visual keyframe bridge — apply computed visual state to actors
      const vis = c.computed.visual;
      if (vis) {
        bloomActor?.send({ type: 'SET_BLOOM_COLOR', color: vis.bloom.color });
        bloomActor?.send({ type: 'SET_STRENGTH', strength: vis.bloom.strength });
        bloomActor?.send({ type: 'SET_THRESHOLD', threshold: vis.bloom.threshold });
        bloomActor?.send({ type: 'SET_RADIUS', radius: vis.bloom.radius });
        bloomActor?.send({ type: vis.bloom.enabled ? 'ENABLE' : 'DISABLE' });

        lightingActor?.send({ type: 'UPDATE_AMBIENT_INTENSITY', intensity: vis.lighting.ambientIntensity });
        lightingActor?.send({ type: 'UPDATE_DIRECTIONAL_INTENSITY', intensity: vis.lighting.directionalIntensity });
        lightingActor?.send({ type: 'UPDATE_POINT_INTENSITY', intensity: vis.lighting.pointIntensity });
        lightingActor?.send({ type: 'UPDATE_EXPOSURE', exposure: vis.lighting.exposure });
        lightingActor?.send({ type: 'UPDATE_HDR_MULTIPLIER', multiplier: vis.lighting.hdrBoostMultiplier });

        materialActor?.send({ type: 'UPDATE_GROUP_EMISSIVE_COLOR', group: 'iris', color: vis.material.iris.emissiveColor });
        materialActor?.send({ type: 'UPDATE_GROUP_EMISSIVE_INTENSITY', group: 'iris', intensity: vis.material.iris.emissiveIntensity });
        materialActor?.send({ type: 'UPDATE_GROUP_EMISSIVE_COLOR', group: 'eyeRings', color: vis.material.eyeRings.emissiveColor });
        materialActor?.send({ type: 'UPDATE_GROUP_EMISSIVE_INTENSITY', group: 'eyeRings', intensity: vis.material.eyeRings.emissiveIntensity });
        materialActor?.send({ type: 'UPDATE_GROUP_EMISSIVE_COLOR', group: 'revealRings', color: vis.material.revealRings.emissiveColor });
        materialActor?.send({ type: 'UPDATE_GROUP_EMISSIVE_INTENSITY', group: 'revealRings', intensity: vis.material.revealRings.emissiveIntensity });

        sceneActor?.send({ type: 'SET_BACKGROUND_COLOR', color: vis.scene.backgroundColor });

        actors.neonBandsActor?.send({ type: 'UPDATE_FLOW_SPEED', speed: vis.neon.flowSpeed });
        actors.neonBandsActor?.send({ type: 'UPDATE_GLOBAL_INTENSITY', intensity: vis.neon.globalIntensity });
      }

      // Element track transform cache
      state.cachedElementTransforms = c.computed.elementTransforms;

      // Card opacity cache (original card)
      state.cachedCardOpacity = c.computed.card.opacity;
      // Instance lifecycle opacity cache (all duplicated instances)
      state.cachedInstanceOpacities = c.computed.instanceOpacities;

      // Eye waypoint → shift boundary center
      const newEyeTarget = c.computed.eyeTarget;
      if (newEyeTarget !== state.cachedEyeTarget) {
        state.cachedEyeTarget = newEyeTarget;
        const ms = modelSettingsRef.current;
        const center = newEyeTarget ?? { x: ms.positionX, y: ms.positionY, z: ms.positionZ };
        const r = state.steeringRanges;
        const hasZEye = (r.zBack + r.zFront) > 0;
        boundaryBehavior.setBounds({
          xMin: center.x - r.xRange, xMax: center.x + r.xRange,
          yMin: center.y - r.yDown, yMax: center.y + r.yUp,
          zMin: hasZEye ? center.z - r.zBack : undefined,
          zMax: hasZEye ? center.z + r.zFront : undefined,
        });
      }
    });
  }

  return { neonBands, neonSub, scrollText, camKeyframes, timelineSub };
}
