import * as THREE from 'three';
import { NeonBandsSystem } from './neonBands.ts';
import { ScrollTextSystem } from './scrollText.ts';
import { CameraKeyframeSystem } from './cameraKeyframes.ts';
import { EyePathSystem } from './eyePathSystem.ts';
import { getFontPath } from '../utils/dracoPath.ts';
import type { SelectionSystem } from './selectionSystem.ts';
import type { SceneActors, SceneMutableState } from './sceneContext.ts';
import type { NeonBandsContext } from '../machines/neonBandsMachine.ts';
import type { TimelineContext, EyePathPoint } from '../machines/timelineMachine.ts';

export interface TimelineBridgeResult {
  neonBands: NeonBandsSystem | null;
  neonSub: { unsubscribe: () => void } | undefined;
  scrollText: ScrollTextSystem | null;
  camKeyframes: CameraKeyframeSystem | null;
  eyePathSystem: EyePathSystem | null;
  timelineSub: { unsubscribe: () => void } | undefined;
  selectionColorSub: { unsubscribe: () => void } | undefined;
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
): TimelineBridgeResult {
  const { neonBandsActor, timelineActor, selectionActor, bloomActor, lightsActor, materialActor, sceneActor } = actors;

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

  // Scroll text + Camera keyframes + Eye path (from unified timelineActor)
  let scrollText: ScrollTextSystem | null = null;
  let camKeyframes: CameraKeyframeSystem | null = null;
  let eyePathSystem: EyePathSystem | null = null;
  let timelineSub: { unsubscribe: () => void } | undefined;
  let cachedEyePathPoints: EyePathPoint[] | null = null;

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

    eyePathSystem = new EyePathSystem(scene);
    // Initial sync
    if (ctx.eyePath.points.length > 0) {
      cachedEyePathPoints = ctx.eyePath.points;
      eyePathSystem.syncFromState(
        ctx.eyePath.points,
        (id, obj) => { selection.register(id, obj); selectionActor?.send({ type: 'REGISTER_ID', id }); },
        (id) => { selection.unregister(id); },
      );
    }

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

        lightsActor?.send({ type: 'SET_AMBIENT', intensity: vis.lighting.ambientIntensity });
        lightsActor?.send({ type: 'SET_EXPOSURE', value: vis.lighting.exposure });
        lightsActor?.send({ type: 'SET_HDR_MULTIPLIER', value: vis.lighting.hdrBoostMultiplier });
        // Map legacy directional/point intensity to default lights
        lightsActor?.send({ type: 'UPDATE_LIGHT_INTENSITY', id: 'dirLight', intensity: vis.lighting.directionalIntensity });
        lightsActor?.send({ type: 'UPDATE_LIGHT_INTENSITY', id: 'pointLight', intensity: vis.lighting.pointIntensity });

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

      // Eye path → 3D curve + spheres
      const newEyePathPoints = c.eyePath.points;
      if (newEyePathPoints !== cachedEyePathPoints && eyePathSystem) {
        cachedEyePathPoints = newEyePathPoints;
        eyePathSystem.syncFromState(
          newEyePathPoints,
          (id, obj) => { selection.register(id, obj); selectionActor?.send({ type: 'REGISTER_ID', id }); },
          (id) => { selection.unregister(id); },
        );
      }

      // Eye path following → cache position + blend for animation loop
      const eps = c.computed.eyePathState;
      if (eps) {
        state.cachedEyePathPosition = eps.position;
        state.cachedEyePathBlend = eps.blend;
        state.cachedEyePathRepulsionScale = eps.repulsionScale;
        state.cachedEyePathTangent = eps.tangent;
      } else {
        state.cachedEyePathPosition = null;
        state.cachedEyePathBlend = 0;
        state.cachedEyePathRepulsionScale = 1;
        state.cachedEyePathTangent = null;
      }

      // Follow path states cache
      state.cachedFollowPathStates = c.computed.followPathStates;
    });
  }

  // Eye path sphere color updates on selection change
  let selectionColorSub: { unsubscribe: () => void } | undefined;
  if (selectionActor && eyePathSystem) {
    const eps = eyePathSystem;
    selectionColorSub = selectionActor.subscribe((snapshot) => {
      const ids = snapshot.context.selectedIds ?? [];
      const points = timelineActor?.getSnapshot().context.eyePath.points ?? [];
      eps.updateColors(new Set(ids), null, points);
    });
  }

  return { neonBands, neonSub, scrollText, camKeyframes, eyePathSystem, timelineSub, selectionColorSub };
}
