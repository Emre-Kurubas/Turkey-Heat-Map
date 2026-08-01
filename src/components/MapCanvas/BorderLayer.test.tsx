import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { BorderLayer } from './BorderLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
];

describe('BorderLayer', () => {
  it('draws one stroked path per feature', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('never fills, so it cannot hide the heat beneath it', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelector('g')?.getAttribute('fill')).toBe('none');
  });

  it('keeps strokes hairline at any zoom via non-scaling-stroke', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelector('path')?.getAttribute('vector-effect'))
      .toBe('non-scaling-stroke');
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelector('g')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('honours the cull set', () => {
    const { container } = render(
      <svg><BorderLayer features={FEATURES} visible={new Set(['06'])} /></svg>,
    );
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('path')?.getAttribute('data-code')).toBe('06');
  });
});
