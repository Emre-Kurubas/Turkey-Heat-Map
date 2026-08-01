import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { SelectionLayer, type SelectionLayerProps } from './SelectionLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
];

function renderLayer(props: Partial<SelectionLayerProps> = {}) {
  return render(
    <svg>
      <SelectionLayer
        features={FEATURES}
        selectedCode={null}
        hoveredCode={null}
        focusedCode={null}
        {...props}
      />
    </svg>,
  );
}

describe('SelectionLayer', () => {
  it('draws nothing when nothing is selected, hovered or focused', () => {
    const { container } = renderLayer();
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });

  it('outlines the hovered region', () => {
    const { container } = renderLayer({ hoveredCode: '34' });
    expect(container.querySelector('path[data-role="hover"]')).not.toBeNull();
  });

  it('outlines the selected region', () => {
    const { container } = renderLayer({ selectedCode: '06' });
    expect(container.querySelector('path[data-role="selected"]')).not.toBeNull();
  });

  it('draws a visible focus ring, which must survive the glass backdrop', () => {
    const { container } = renderLayer({ focusedCode: '34' });
    const ring = container.querySelector('path[data-role="focus"]');
    expect(ring?.getAttribute('stroke')).toBe('var(--hm-focus-ring)');
  });

  it('can show selection and hover on different regions at once', () => {
    const { container } = renderLayer({ selectedCode: '34', hoveredCode: '06' });
    expect(container.querySelector('path[data-role="selected"]')?.getAttribute('data-code'))
      .toBe('34');
    expect(container.querySelector('path[data-role="hover"]')?.getAttribute('data-code'))
      .toBe('06');
  });

  it('ignores a code with no matching feature', () => {
    const { container } = renderLayer({ selectedCode: 'yok' });
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });

  it('keeps highlights out of the hit path', () => {
    const { container } = renderLayer({ selectedCode: '34' });
    expect((container.querySelector('g') as SVGGElement).style.pointerEvents).toBe('none');
  });

  it('is hidden from assistive technology, since HitLayer already announces state', () => {
    const { container } = renderLayer({ selectedCode: '34' });
    expect(container.querySelector('g')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SelectionLayer — the province being explored', () => {
  const PROVINCE: RenderFeature = { code: '34', name: 'İstanbul', d: 'M0,0L99,0L99,99Z' };

  it('draws nothing extra when no province is in context', () => {
    const { container } = renderLayer();
    expect(container.querySelector('[data-role="context"]')).toBeNull();
  });

  it('draws the province boundary when one is passed', () => {
    const { container } = renderLayer({ contextFeature: PROVINCE });
    const group = container.querySelector('[data-role="context"]');
    expect(group).not.toBeNull();
    expect(group).toHaveAttribute('data-code', '34');
  });

  it('casings it, so it does not read as one more district border', () => {
    // Zoomed in, the map is a mesh of dark district borders. A single heavier
    // line of the same ink is just a thicker one of those; the pale stroke
    // underneath is what separates it from the mesh.
    const { container } = renderLayer({ contextFeature: PROVINCE });
    const strokes = [...container.querySelectorAll('[data-role="context"] path')]
      .map((path) => path.getAttribute('stroke'));
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).not.toBe(strokes[1]);
  });

  it('draws the casing wider than the line it carries', () => {
    const { container } = renderLayer({ contextFeature: PROVINCE });
    const widths = [...container.querySelectorAll('[data-role="context"] path')]
      .map((path) => Number(path.getAttribute('stroke-width')));
    expect(widths[0]).toBeGreaterThan(widths[1]!);
  });

  it('keeps its weight through zoom, like every other highlight', () => {
    const { container } = renderLayer({ contextFeature: PROVINCE });
    for (const path of container.querySelectorAll('[data-role="context"] path')) {
      expect(path).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    }
  });

  it('sits under the selection, so a district clicked inside it still reads', () => {
    const { container } = renderLayer({ contextFeature: PROVINCE, selectedCode: '06' });
    const roles = [...container.querySelectorAll('[data-role]')]
      .map((node) => node.getAttribute('data-role'));
    expect(roles.indexOf('context')).toBeLessThan(roles.indexOf('selected'));
  });
});
