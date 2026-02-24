import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { scrollTextMachine, TextElementLayout } from '../machines/scrollTextMachine.ts';

export function useScrollText(actorRef: ActorRefFrom<typeof scrollTextMachine>) {
  const scrollProgress = useSelector(actorRef, (state) => state.context.scrollProgress);
  const titleText = useSelector(actorRef, (state) => state.context.titleText);
  const subtitleText = useSelector(actorRef, (state) => state.context.subtitleText);
  const titleFontSize = useSelector(actorRef, (state) => state.context.titleFontSize);
  const subtitleFontSize = useSelector(actorRef, (state) => state.context.subtitleFontSize);
  const titleColor = useSelector(actorRef, (state) => state.context.titleColor);
  const subtitleColor = useSelector(actorRef, (state) => state.context.subtitleColor);
  const titleEmissiveIntensity = useSelector(actorRef, (state) => state.context.titleEmissiveIntensity);
  const subtitleEmissiveIntensity = useSelector(actorRef, (state) => state.context.subtitleEmissiveIntensity);
  const titleLayout = useSelector(actorRef, (state) => state.context.titleLayout);
  const subtitleLayout = useSelector(actorRef, (state) => state.context.subtitleLayout);
  const visible = useSelector(actorRef, (state) => state.context.visible);

  const updateScroll = (progress: number) => { actorRef.send({ type: 'UPDATE_SCROLL', progress }); };
  const setTitleText = (text: string) => { actorRef.send({ type: 'SET_TITLE_TEXT', text }); };
  const setSubtitleText = (text: string) => { actorRef.send({ type: 'SET_SUBTITLE_TEXT', text }); };
  const setTitleFontSize = (size: number) => { actorRef.send({ type: 'SET_TITLE_FONT_SIZE', size }); };
  const setSubtitleFontSize = (size: number) => { actorRef.send({ type: 'SET_SUBTITLE_FONT_SIZE', size }); };
  const setTitleColor = (color: string) => { actorRef.send({ type: 'SET_TITLE_COLOR', color }); };
  const setSubtitleColor = (color: string) => { actorRef.send({ type: 'SET_SUBTITLE_COLOR', color }); };
  const setTitleEmissive = (intensity: number) => { actorRef.send({ type: 'SET_TITLE_EMISSIVE', intensity }); };
  const setSubtitleEmissive = (intensity: number) => { actorRef.send({ type: 'SET_SUBTITLE_EMISSIVE', intensity }); };
  const setTitleLayout = (layout: Partial<TextElementLayout>) => { actorRef.send({ type: 'SET_TITLE_LAYOUT', layout }); };
  const setSubtitleLayout = (layout: Partial<TextElementLayout>) => { actorRef.send({ type: 'SET_SUBTITLE_LAYOUT', layout }); };
  const importLayout = (tl: TextElementLayout, sl: TextElementLayout) => { actorRef.send({ type: 'IMPORT_LAYOUT', titleLayout: tl, subtitleLayout: sl }); };
  const setVisible = (visible: boolean) => { actorRef.send({ type: 'SET_VISIBLE', visible }); };
  const restoreDefaults = () => { actorRef.send({ type: 'RESTORE_DEFAULTS' }); };

  return {
    scrollProgress, titleText, subtitleText,
    titleFontSize, subtitleFontSize,
    titleColor, subtitleColor,
    titleEmissiveIntensity, subtitleEmissiveIntensity,
    titleLayout, subtitleLayout, visible,
    updateScroll, setTitleText, setSubtitleText,
    setTitleFontSize, setSubtitleFontSize,
    setTitleColor, setSubtitleColor,
    setTitleEmissive, setSubtitleEmissive,
    setTitleLayout, setSubtitleLayout, importLayout,
    setVisible, restoreDefaults,
  };
}
