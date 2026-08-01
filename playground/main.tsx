import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CrimeHeatMap } from '../src/index.js';
import { generateMockData } from '../src/data/mock/index.js';

const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const dataset = generateMockData({ seed: 42, years: YEARS, includeIlce: true });

const root = document.getElementById('root');
if (root === null) throw new Error('#root yok');

createRoot(root).render(
  <StrictMode>
    <CrimeHeatMap
      data={dataset.records}
      categories={dataset.categories}
      population={dataset.population}
      onRegionClick={(region) => { console.log('[playground] tıklama', region); }}
      onDataWarning={(warnings) => { console.warn('[playground] uyarı', warnings); }}
    />
  </StrictMode>,
);
