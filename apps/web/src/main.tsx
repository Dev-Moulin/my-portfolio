import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './i18n';
import App from './App';
import { blockPinchZoom } from './utils/blockPinchZoom';

blockPinchZoom();

// Télémétrie dev-only (erreurs, FPS, contexte nav → dev-server /__perf). Import dynamique :
// en prod, import.meta.env.DEV est faux à la compilation → le chunk n'existe même pas.
if (import.meta.env.DEV) {
  import('./utils/perfTelemetry').then((m) => m.startPerfTelemetry());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
