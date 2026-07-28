// @portfolio/overmind-3d — Public API

export { OvermindOverlay } from './components/OvermindOverlay.tsx';
export type { OvermindOverlayProps } from './components/OvermindOverlay.tsx';
export { DevControlPanel } from './components/devPanel/DevControlPanel.tsx';
export { StarfieldDevPanel } from './components/StarfieldDevPanel.tsx';

export { OvermindProvider } from './context/OvermindProvider.tsx';
export { useOvermind } from './hooks/useOvermind.ts';

// Standalone test scenes (activated via URL hash, no impact on the main portfolio)
export { SentinelTrainScene } from './sentinelTrain/SentinelTrainScene.tsx';
