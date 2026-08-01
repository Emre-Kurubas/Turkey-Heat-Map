import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createColorScale } from '@/core/color/index.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { HeatLayer, type HeatLayerProps } from './HeatLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
  { code: '35', name: 'İzmir', d: 'M40,0L50,0L50,10Z' },
];

const VALUES = new Map([['34', 100], ['06', 40]]);
const SCALE = createColorScale({ values: [100, 40], mode: 'quantile', ramp: 'ember' });

function renderLayer(props: Partial<HeatLayerProps> = {}) {
  return render(
    <svg>
      <HeatLayer
        features={FEATURES}
        values={VALUES}
        scale={SCALE}
        idPrefix="t"
        heatStyle="glow"
        {...props}
      />
    </svg>,
  );
}

describe('HeatLayer', () => {
  it('draws one path per feature', () => {
    const { container } = renderLayer();
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });

  it('fills each region from the colour scale', () => {
    const { container } = renderLayer();
    const istanbul = container.querySelector('path[data-code="34"]');
    expect(istanbul?.getAttribute('fill')).toBe(SCALE(100));
  });

  it('renders a region with no data in the no-data fill, not in a scale colour', () => {
    const { container } = renderLayer();
    const izmir = container.querySelector('path[data-code="35"]');
    expect(izmir?.getAttribute('fill')).toBe('var(--hm-no-data)');
  });

  it('applies the blur filter in glow mode', () => {
    const { container } = renderLayer();
    expect(container.querySelector('g')?.getAttribute('filter')).toBe('url(#t-blur)');
  });

  it('applies no filter in flat mode, which is the documented escape hatch', () => {
    const { container } = renderLayer({ heatStyle: 'flat' });
    expect(container.querySelector('g')?.getAttribute('filter')).toBeNull();
  });

  it('clips the bleed to the country outline', () => {
    const { container } = renderLayer();
    expect(container.querySelector('g')?.getAttribute('clip-path')).toBe('url(#t-outline)');
  });

  it('is hidden from assistive technology, since HitLayer carries the semantics', () => {
    const { container } = renderLayer();
    expect(container.querySelector('g')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders only visible features when a cull set is supplied', () => {
    const { container } = renderLayer({ visible: new Set(['34']) });
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('renders everything when no cull set is supplied', () => {
    const { container } = renderLayer();
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });
});
