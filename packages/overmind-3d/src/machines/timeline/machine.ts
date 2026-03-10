import { setup, assign } from 'xstate';
import type { TimelineContext, TimelineEvents } from './types.ts';
import { recompute, sortKeyframes, ensureHandles, subdivideBezierSegment } from './compute.ts';
import {
  DEFAULTS, DEFAULT_TITLE_LAYOUT, DEFAULT_SUBTITLE_LAYOUT,
  DEFAULT_CARD_LAYOUT, DEFAULT_CARD_SCROLL_START, DEFAULT_CARD_SCROLL_END,
  DEFAULT_EYE_PATH,
} from './defaults.ts';

// ── Machine ───────────────────────────────────────────────────────────────────

export const timelineMachine = setup({
  types: {} as {
    context: TimelineContext;
    events: TimelineEvents;
  },
}).createMachine({
  id: 'timeline',
  context: { ...DEFAULTS },
  on: {
    // ── Core ──────────────────────────────────────────────────────────────
    UPDATE_FRAME: {
      actions: assign(({ context, event }) => {
        const currentFrame = Math.max(0, event.frame);
        return { currentFrame, computed: recompute({ ...context, currentFrame }) };
      }),
    },
    SET_TOTAL_FRAMES: {
      actions: assign({ totalFrames: ({ event }) => Math.max(1, event.totalFrames) }),
    },

    // ── Dwells ────────────────────────────────────────────────────────────
    ADD_DWELL: {
      actions: assign({
        dwells: ({ context, event }) => [...context.dwells, event.dwell].sort((a, b) => a.at - b.at),
      }),
    },
    DELETE_DWELL: {
      actions: assign({
        dwells: ({ context, event }) => context.dwells.filter((_, i) => i !== event.index),
      }),
    },
    UPDATE_DWELL: {
      actions: assign({
        dwells: ({ context, event }) => {
          const updated = [...context.dwells];
          if (event.index >= 0 && event.index < updated.length) {
            updated[event.index] = event.dwell;
          }
          return updated.sort((a, b) => a.at - b.at);
        },
      }),
    },

    // ── Camera ────────────────────────────────────────────────────────────
    ADD_KEYFRAME: {
      actions: assign(({ context, event }) => {
        const cameraKeyframes = sortKeyframes([...context.cameraKeyframes, event.keyframe]);
        return { cameraKeyframes, computed: recompute({ ...context, cameraKeyframes }) };
      }),
    },
    UPDATE_KEYFRAME: {
      actions: assign(({ context, event }) => {
        const updated = [...context.cameraKeyframes];
        if (event.index >= 0 && event.index < updated.length) {
          updated[event.index] = event.keyframe;
        }
        const cameraKeyframes = sortKeyframes(updated);
        return { cameraKeyframes, computed: recompute({ ...context, cameraKeyframes }) };
      }),
    },
    DELETE_KEYFRAME: {
      actions: assign(({ context, event }) => {
        const cameraKeyframes = context.cameraKeyframes.filter((_, i) => i !== event.index);
        return { cameraKeyframes, computed: recompute({ ...context, cameraKeyframes }) };
      }),
    },
    SET_CAMERA_ENABLED: {
      actions: assign(({ context, event }) => {
        const cameraEnabled = event.enabled;
        return { cameraEnabled, computed: recompute({ ...context, cameraEnabled }) };
      }),
    },
    IMPORT_KEYFRAMES: {
      actions: assign(({ context, event }) => {
        const cameraKeyframes = sortKeyframes(event.keyframes);
        return { cameraKeyframes, computed: recompute({ ...context, cameraKeyframes }) };
      }),
    },

    // ── Text (no recompute needed) ────────────────────────────────────────
    SET_TITLE_DISPLAY_NAME: {
      actions: assign({ titleDisplayName: ({ event }) => event.name }),
    },
    SET_SUBTITLE_DISPLAY_NAME: {
      actions: assign({ subtitleDisplayName: ({ event }) => event.name }),
    },
    SET_TITLE_TEXT: {
      actions: assign({ titleText: ({ event }) => event.text }),
    },
    SET_SUBTITLE_TEXT: {
      actions: assign({ subtitleText: ({ event }) => event.text }),
    },
    SET_TITLE_FONT_SIZE: {
      actions: assign({ titleFontSize: ({ event }) => event.size }),
    },
    SET_SUBTITLE_FONT_SIZE: {
      actions: assign({ subtitleFontSize: ({ event }) => event.size }),
    },
    SET_TITLE_COLOR: {
      actions: assign({ titleColor: ({ event }) => event.color }),
    },
    SET_SUBTITLE_COLOR: {
      actions: assign({ subtitleColor: ({ event }) => event.color }),
    },
    SET_TITLE_EMISSIVE: {
      actions: assign({ titleEmissiveIntensity: ({ event }) => event.intensity }),
    },
    SET_SUBTITLE_EMISSIVE: {
      actions: assign({ subtitleEmissiveIntensity: ({ event }) => event.intensity }),
    },

    // ── Text layouts (recompute needed) ───────────────────────────────────
    SET_TITLE_LAYOUT: {
      actions: assign(({ context, event }) => {
        const titleLayout = { ...context.titleLayout, ...event.layout };
        return { titleLayout, computed: recompute({ ...context, titleLayout }) };
      }),
    },
    SET_SUBTITLE_LAYOUT: {
      actions: assign(({ context, event }) => {
        const subtitleLayout = { ...context.subtitleLayout, ...event.layout };
        return { subtitleLayout, computed: recompute({ ...context, subtitleLayout }) };
      }),
    },
    IMPORT_LAYOUT: {
      actions: assign(({ context, event }) => {
        const titleLayout = { ...DEFAULT_TITLE_LAYOUT, ...event.titleLayout };
        const subtitleLayout = { ...DEFAULT_SUBTITLE_LAYOUT, ...event.subtitleLayout };
        return { titleLayout, subtitleLayout, computed: recompute({ ...context, titleLayout, subtitleLayout }) };
      }),
    },
    SET_TEXT_VISIBLE: {
      actions: assign({ textVisible: ({ event }) => event.visible }),
    },

    // ── Card ──────────────────────────────────────────────────────────────
    SET_CARD_ENABLED: {
      actions: assign({ cardEnabled: ({ event }) => event.enabled }),
    },
    SET_CARD_POS_TOP: {
      actions: assign({ cardPosTop: ({ event }) => event.value }),
    },
    SET_CARD_POS_LEFT: {
      actions: assign({ cardPosLeft: ({ event }) => event.value }),
    },
    SET_CARD_LAYOUT: {
      actions: assign(({ context, event }) => {
        const cardLayout = { ...context.cardLayout, ...event.layout };
        return { cardLayout, computed: recompute({ ...context, cardLayout }) };
      }),
    },
    ADD_INSTANCE_LIFECYCLE: {
      actions: assign(({ context, event }) => {
        const instanceLifecycles = { ...context.instanceLifecycles, [event.id]: event.lifecycle };
        return { instanceLifecycles, computed: recompute({ ...context, instanceLifecycles }) };
      }),
    },
    SET_INSTANCE_LIFECYCLE: {
      actions: assign(({ context, event }) => {
        const existing = context.instanceLifecycles[event.id];
        if (!existing) return {};
        const instanceLifecycles = { ...context.instanceLifecycles, [event.id]: { ...existing, ...event.lifecycle } };
        return { instanceLifecycles, computed: recompute({ ...context, instanceLifecycles }) };
      }),
    },
    DELETE_INSTANCE_LIFECYCLE: {
      actions: assign(({ context, event }) => {
        const { [event.id]: _, ...instanceLifecycles } = context.instanceLifecycles;
        return { instanceLifecycles, computed: recompute({ ...context, instanceLifecycles }) };
      }),
    },

    // ── Visual keyframes ────────────────────────────────────────────────
    ADD_VISUAL_KF: {
      actions: assign(({ context, event }) => {
        const visualKeyframes = [...context.visualKeyframes, event.keyframe].sort((a, b) => a.at - b.at);
        return { visualKeyframes, computed: recompute({ ...context, visualKeyframes }) };
      }),
    },
    UPDATE_VISUAL_KF: {
      actions: assign(({ context, event }) => {
        const updated = [...context.visualKeyframes];
        if (event.index >= 0 && event.index < updated.length) {
          updated[event.index] = event.keyframe;
        }
        const visualKeyframes = updated.sort((a, b) => a.at - b.at);
        return { visualKeyframes, computed: recompute({ ...context, visualKeyframes }) };
      }),
    },
    DELETE_VISUAL_KF: {
      actions: assign(({ context, event }) => {
        const visualKeyframes = context.visualKeyframes.filter((_, i) => i !== event.index);
        return { visualKeyframes, computed: recompute({ ...context, visualKeyframes }) };
      }),
    },
    IMPORT_VISUAL_KFS: {
      actions: assign(({ context, event }) => {
        const visualKeyframes = [...event.keyframes].sort((a, b) => a.at - b.at);
        return { visualKeyframes, computed: recompute({ ...context, visualKeyframes }) };
      }),
    },
    SET_VISUAL_ENABLED: {
      actions: assign(({ context, event }) => {
        const visualEnabled = event.enabled;
        return { visualEnabled, computed: recompute({ ...context, visualEnabled }) };
      }),
    },

    // ── Element transform tracks ────────────────────────────────────────
    ADD_ELEMENT_KF: {
      actions: assign(({ context, event }) => {
        const { elementId, keyframe } = event;
        const existing = context.elementTracks[elementId] ?? [];
        // Replace if a keyframe already exists at the same frame
        const filtered = existing.filter(kf => Math.round(kf.frame) !== Math.round(keyframe.frame));
        const track = [...filtered, keyframe].sort((a, b) => a.frame - b.frame);
        const elementTracks = { ...context.elementTracks, [elementId]: track };
        return { elementTracks, computed: recompute({ ...context, elementTracks }) };
      }),
    },
    UPDATE_ELEMENT_KF: {
      actions: assign(({ context, event }) => {
        const { elementId, index, keyframe } = event;
        const existing = context.elementTracks[elementId];
        if (!existing || index < 0 || index >= existing.length) return {};
        const updated = [...existing];
        updated[index] = keyframe;
        const track = updated.sort((a, b) => a.frame - b.frame);
        const elementTracks = { ...context.elementTracks, [elementId]: track };
        return { elementTracks, computed: recompute({ ...context, elementTracks }) };
      }),
    },
    DELETE_ELEMENT_KF: {
      actions: assign(({ context, event }) => {
        const { elementId, index } = event;
        const existing = context.elementTracks[elementId];
        if (!existing || index < 0 || index >= existing.length) return {};
        const track = existing.filter((_, i) => i !== index);
        const elementTracks = { ...context.elementTracks };
        if (track.length === 0) {
          delete elementTracks[elementId];
        } else {
          elementTracks[elementId] = track;
        }
        return { elementTracks, computed: recompute({ ...context, elementTracks }) };
      }),
    },
    DELETE_ELEMENT_TRACK: {
      actions: assign(({ context, event }) => {
        const { elementId } = event;
        const elementTracks = { ...context.elementTracks };
        delete elementTracks[elementId];
        return { elementTracks, computed: recompute({ ...context, elementTracks }) };
      }),
    },
    IMPORT_ELEMENT_TRACKS: {
      actions: assign(({ context, event }) => {
        const elementTracks = Object.fromEntries(
          Object.entries(event.tracks).map(([id, kfs]) =>
            [id, [...kfs].sort((a, b) => a.frame - b.frame)]
          )
        );
        return { elementTracks, computed: recompute({ ...context, elementTracks }) };
      }),
    },

    // ── Eye path ──────────────────────────────────────────────────────────
    ADD_EYE_PATH_PT: {
      actions: assign(({ context, event }) => {
        const filtered = context.eyePath.points.filter(
          pt => Math.round(pt.frame) !== Math.round(event.point.frame)
        );
        const points = ensureHandles([...filtered, event.point].sort((a, b) => a.frame - b.frame));
        const eyePath = { ...context.eyePath, points };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },
    UPDATE_EYE_PATH_PT: {
      actions: assign(({ context, event }) => {
        const { index, point } = event;
        if (index < 0 || index >= context.eyePath.points.length) return {};
        const updated = [...context.eyePath.points];
        updated[index] = point;
        const points = ensureHandles(updated.sort((a, b) => a.frame - b.frame));
        const eyePath = { ...context.eyePath, points };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },
    DELETE_EYE_PATH_PT: {
      actions: assign(({ context, event }) => {
        const points = ensureHandles(context.eyePath.points.filter((_, i) => i !== event.index));
        const eyePath = { ...context.eyePath, points };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },
    SET_EYE_PATH_ENABLED: {
      actions: assign(({ context, event }) => {
        const eyePath = { ...context.eyePath, enabled: event.enabled };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },
    SET_EYE_PATH_TRANSITIONS: {
      actions: assign(({ context, event }) => ({
        eyePath: { ...context.eyePath, transitionIn: event.transitionIn, transitionOut: event.transitionOut },
      })),
    },
    SET_EYE_PATH_MAX_INFLUENCE: {
      actions: assign(({ context, event }) => {
        const eyePath = { ...context.eyePath, maxInfluence: event.maxInfluence };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },
    IMPORT_EYE_PATH: {
      actions: assign(({ context, event }) => {
        const points = ensureHandles([...event.eyePath.points].sort((a, b) => a.frame - b.frame));
        const eyePath = { ...event.eyePath, points };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },
    SUBDIVIDE_EYE_PATH: {
      actions: assign(({ context, event }) => {
        const midPt = subdivideBezierSegment(context.eyePath.points, event.index);
        if (!midPt) return {};
        const pts = [...context.eyePath.points];
        pts.splice(event.index + 1, 0, midPt);
        const points = ensureHandles(pts);
        const eyePath = { ...context.eyePath, points };
        return { eyePath, computed: recompute({ ...context, eyePath }) };
      }),
    },

    // ── Follow path ──────────────────────────────────────────────────────
    ASSIGN_FOLLOW_PATH: {
      actions: assign(({ context, event }) => {
        const filtered = context.followPathAssignments.filter(a => a.instanceId !== event.assignment.instanceId);
        const followPathAssignments = [...filtered, event.assignment];
        return { followPathAssignments, computed: recompute({ ...context, followPathAssignments }) };
      }),
    },
    UNASSIGN_FOLLOW_PATH: {
      actions: assign(({ context, event }) => {
        const followPathAssignments = context.followPathAssignments.filter(a => a.instanceId !== event.instanceId);
        return { followPathAssignments, computed: recompute({ ...context, followPathAssignments }) };
      }),
    },
    UPDATE_FOLLOW_PATH: {
      actions: assign(({ context, event }) => {
        const followPathAssignments = context.followPathAssignments.map(a =>
          a.instanceId === event.instanceId ? { ...a, ...event.patch } : a
        );
        return { followPathAssignments, computed: recompute({ ...context, followPathAssignments }) };
      }),
    },

    // ── Global ────────────────────────────────────────────────────────────
    IMPORT_TIMELINE: {
      actions: assign(({ context, event }) => {
        const d = event.data;
        const totalFrames = d.totalFrames;
        const dwells = d.dwells.sort((a, b) => a.at - b.at);
        const cameraKeyframes = sortKeyframes(d.cameraKeyframes);
        const titleLayout = { ...DEFAULT_TITLE_LAYOUT, ...d.titleLayout };
        const subtitleLayout = { ...DEFAULT_SUBTITLE_LAYOUT, ...d.subtitleLayout };
        // Rétrocompatibilité: si cardLayout existe, l'utiliser. Sinon fallback sur cardScrollStart/cardScrollEnd
        const cardLayout = d.cardLayout
          ? { ...DEFAULT_CARD_LAYOUT, ...d.cardLayout }
          : {
              ...DEFAULT_CARD_LAYOUT,
              scrollStart: d.cardScrollStart ?? DEFAULT_CARD_SCROLL_START,
              scrollEnd: d.cardScrollEnd ?? DEFAULT_CARD_SCROLL_END,
            };
        const visualKeyframes = (d.visualKeyframes ?? []).sort((a, b) => a.at - b.at);
        const elementTracks = Object.fromEntries(
          Object.entries(d.elementTracks ?? {}).map(([id, kfs]) =>
            [id, [...kfs].sort((a, b) => a.frame - b.frame)]
          )
        );
        const instanceLifecycles = d.instanceLifecycles ?? d.cardLayouts ?? {};
        const rawEyePath = d.eyePath ?? DEFAULT_EYE_PATH;
        const eyePath = { ...rawEyePath, maxInfluence: rawEyePath.maxInfluence ?? 0.8, points: ensureHandles([...rawEyePath.points].sort((a, b) => a.frame - b.frame)) };
        const followPathAssignments = d.followPathAssignments ?? [];
        const merged = {
          ...context, totalFrames, dwells, cameraKeyframes,
          titleLayout, subtitleLayout, cardLayout, instanceLifecycles, visualKeyframes, elementTracks, eyePath,
          followPathAssignments,
        };
        return {
          totalFrames, dwells, cameraKeyframes,
          titleLayout, subtitleLayout, cardLayout, instanceLifecycles, visualKeyframes, elementTracks, eyePath,
          followPathAssignments,
          computed: recompute(merged),
        };
      }),
    },
    RESTORE_DEFAULTS: {
      actions: assign(() => ({ ...DEFAULTS })),
    },
    RESTORE_CONTEXT: {
      actions: assign(({ event }) => ({
        ...event.context,
        computed: recompute(event.context as TimelineContext),
      })),
    },
  },
});
