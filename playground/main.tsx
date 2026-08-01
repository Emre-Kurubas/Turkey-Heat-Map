import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlassPanel } from '../src/components/primitives/GlassPanel.js';

const root = document.getElementById('root');
if (root === null) throw new Error('#root yok');

createRoot(root).render(
  <StrictMode>
    <GlassPanel label="Deneme">Playground ayakta.</GlassPanel>
  </StrictMode>,
);
