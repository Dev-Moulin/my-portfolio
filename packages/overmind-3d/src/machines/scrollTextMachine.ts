import { setup, assign } from 'xstate';
import type { EasingType } from '../utils/easing.ts';

export interface TextElementLayout {
  startX: number; startY: number; startZ: number;
  endX: number;   endY: number;   endZ: number;
  scrollStart: number;
  scrollEnd: number;
  easing: EasingType;
  // Exit phase
  exitX: number; exitY: number; exitZ: number;
  exitStart: number;
  exitEnd: number;
  exitEasing: EasingType;
}

/** Offset X appliqué pour l'arrivée et la sortie (texte glisse depuis/vers la gauche) */
export const SCROLL_TEXT_OFFSET_X = -20;
/** Offset Z appliqué à la sortie (texte s'éloigne en profondeur en sortant) */
export const SCROLL_TEXT_EXIT_Z_OFFSET = 7.8;

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

export type ScrollTextEvents =
  | { type: 'UPDATE_SCROLL'; progress: number }
  | { type: 'SET_TITLE_TEXT'; text: string }
  | { type: 'SET_SUBTITLE_TEXT'; text: string }
  | { type: 'SET_TITLE_FONT_SIZE'; size: number }
  | { type: 'SET_SUBTITLE_FONT_SIZE'; size: number }
  | { type: 'SET_TITLE_COLOR'; color: string }
  | { type: 'SET_SUBTITLE_COLOR'; color: string }
  | { type: 'SET_TITLE_EMISSIVE'; intensity: number }
  | { type: 'SET_SUBTITLE_EMISSIVE'; intensity: number }
  | { type: 'SET_TITLE_LAYOUT'; layout: Partial<TextElementLayout> }
  | { type: 'SET_SUBTITLE_LAYOUT'; layout: Partial<TextElementLayout> }
  | { type: 'IMPORT_LAYOUT'; titleLayout: TextElementLayout; subtitleLayout: TextElementLayout }
  | { type: 'SET_VISIBLE'; visible: boolean }
  | { type: 'RESTORE_DEFAULTS' };

const DEFAULT_TITLE_LAYOUT: TextElementLayout = {
  startX: 2 + SCROLL_TEXT_OFFSET_X, startY: 8.33, startZ: 9.84,
  endX: 2,    endY: 8.33,   endZ: 9.84,
  scrollStart: 0.0,
  scrollEnd: 0.15,
  easing: 'smoothstep',
  exitX: 2, exitY: 8.33, exitZ: 9.84 + SCROLL_TEXT_EXIT_Z_OFFSET,
  exitStart: 0.468,
  exitEnd: 0.528,
  exitEasing: 'smoothstep',
};

const DEFAULT_SUBTITLE_LAYOUT: TextElementLayout = {
  startX: 1.67 + SCROLL_TEXT_OFFSET_X, startY: 6.79, startZ: 12.82,
  endX: 1.67,    endY: 6.79,   endZ: 12.82,
  scrollStart: 0.05,
  scrollEnd: 0.20,
  easing: 'smoothstep',
  exitX: 1.67, exitY: 6.79, exitZ: 12.82 + SCROLL_TEXT_EXIT_Z_OFFSET,
  exitStart: 0.440,
  exitEnd: 0.498,
  exitEasing: 'smoothstep',
};

const DEFAULTS: ScrollTextContext = {
  scrollProgress: 0,
  titleText: 'Paul Moulin',
  titleFontSize: 1.5,
  titleColor: '#ffffff',
  titleEmissiveIntensity: 0.7,
  subtitleText: 'Contributing to the Future of Trust\nWeb3 Full-Stack Developer & 3D Enthusiast\nBuilding Decentralized Experiences',
  subtitleFontSize: 0.41,
  subtitleColor: '#aaaacc',
  subtitleEmissiveIntensity: 1.3,
  titleLayout: { ...DEFAULT_TITLE_LAYOUT },
  subtitleLayout: { ...DEFAULT_SUBTITLE_LAYOUT },
  visible: true,
};

export const scrollTextMachine = setup({
  types: {} as {
    context: ScrollTextContext;
    events: ScrollTextEvents;
  },
}).createMachine({
  id: 'scrollText',
  context: { ...DEFAULTS },
  on: {
    UPDATE_SCROLL: {
      actions: assign({
        scrollProgress: ({ event }) => Math.max(0, Math.min(1, event.progress)),
      }),
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
    SET_TITLE_LAYOUT: {
      actions: assign({
        titleLayout: ({ context, event }) => ({ ...context.titleLayout, ...event.layout }),
      }),
    },
    SET_SUBTITLE_LAYOUT: {
      actions: assign({
        subtitleLayout: ({ context, event }) => ({ ...context.subtitleLayout, ...event.layout }),
      }),
    },
    IMPORT_LAYOUT: {
      actions: assign({
        titleLayout: ({ event }) => ({ ...DEFAULT_TITLE_LAYOUT, ...event.titleLayout }),
        subtitleLayout: ({ event }) => ({ ...DEFAULT_SUBTITLE_LAYOUT, ...event.subtitleLayout }),
      }),
    },
    SET_VISIBLE: {
      actions: assign({ visible: ({ event }) => event.visible }),
    },
    RESTORE_DEFAULTS: {
      actions: assign({ ...DEFAULTS }),
    },
  },
});
