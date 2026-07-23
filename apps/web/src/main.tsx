import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './i18n';
import App from './App';
import { blockPinchZoom } from './utils/blockPinchZoom';

blockPinchZoom();

// Mobile + PORTRAIT : on NE monte PAS l'app (donc pas de scène 3D lourde chargée). Le gate « pivoter »
// statique d'index.html est déjà affiché et rechargera la page au passage en paysage — c'est CE
// chargement-là (en paysage) qui montera l'app avec le loader. Évite un double chargement de la scène.
const coarse = window.matchMedia('(pointer: coarse)').matches;
const portrait = window.matchMedia('(orientation: portrait)').matches;

if (!(coarse && portrait)) {
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
}
