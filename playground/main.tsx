import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MapCanvas } from '../src/components/MapCanvas/index.js';
import { HeatMapProvider } from '../src/context/HeatMapProvider.js';
import { createHeatMapStore } from '../src/context/HeatMapStore.js';
import { createHoverStore } from '../src/context/HoverStore.js';
import { generateMockData } from '../src/data/mock/index.js';
import { trStrings } from '../src/i18n/index.js';
import '../src/styles/index.js';

const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const dataset = generateMockData({ seed: 42, years: YEARS, includeIlce: true });

const store = createHeatMapStore({
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
});

const root = document.getElementById('root');
if (root === null) throw new Error('#root yok');

createRoot(root).render(
  <StrictMode>
    <div className="hm-root">
      <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
        <MapCanvas
          data={dataset.records}
          categories={dataset.categories}
          colorScale="spectral"
          heatStyle="glow"
        />
      </HeatMapProvider>
    </div>
  </StrictMode>,
);
