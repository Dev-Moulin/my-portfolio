import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './i18n';
import App from './App';
import { blockPinchZoom } from './utils/blockPinchZoom';

blockPinchZoom();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
