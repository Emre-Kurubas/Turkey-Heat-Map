import { describe, expect, it } from 'vitest';
import { mergeStrings, trStrings } from './index.js';

describe('trStrings', () => {
  it('has no empty strings anywhere', () => {
    const walk = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        expect(node, path).not.toBe('');
        return;
      }
      if (typeof node === 'function') return;
      for (const [key, value] of Object.entries(node as object)) {
        walk(value, `${path}.${key}`);
      }
    };
    walk(trStrings, 'trStrings');
  });

  it('formats the region tooltip title with the region name', () => {
    expect(trStrings.tooltip.title('Ankara')).toBe('Ankara');
  });

  it('names both geo levels in Turkish', () => {
    expect(trStrings.level.il).toBe('İl');
    expect(trStrings.level.ilce).toBe('İlçe');
  });

  it('labels each scale mode, since the legend must always state the active one', () => {
    expect(trStrings.scaleMode.quantile).toBeTruthy();
    expect(trStrings.scaleMode.linear).toBeTruthy();
    expect(trStrings.scaleMode.log).toBeTruthy();
  });
});

describe('mergeStrings', () => {
  it('returns the Turkish table unchanged when given nothing', () => {
    expect(mergeStrings()).toEqual(trStrings);
  });

  it('overrides a single leaf without dropping its siblings', () => {
    const merged = mergeStrings({ legend: { title: 'Ölçek' } });
    expect(merged.legend.title).toBe('Ölçek');
    expect(merged.legend.noData).toBe(trStrings.legend.noData);
  });

  it('leaves the original table untouched', () => {
    const before = trStrings.legend.title;
    mergeStrings({ legend: { title: 'Değişti' } });
    expect(trStrings.legend.title).toBe(before);
  });

  it('ignores an undefined override value rather than erasing the default', () => {
    const merged = mergeStrings({ legend: { title: undefined } });
    expect(merged.legend.title).toBe(trStrings.legend.title);
  });
});
