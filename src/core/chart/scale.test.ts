import { describe, expect, it } from 'vitest';
import { createLinearScale, snapToStep } from './scale.js';

describe('createLinearScale', () => {
  const scale = createLinearScale([2015, 2024], [0, 900]);

  it('maps the domain ends to the range ends', () => {
    expect(scale.toRange(2015)).toBe(0);
    expect(scale.toRange(2024)).toBe(900);
  });

  it('maps the midpoint proportionally', () => {
    expect(scale.toRange(2019.5)).toBeCloseTo(450);
  });

  it('inverts back to the domain', () => {
    expect(scale.toDomain(0)).toBe(2015);
    expect(scale.toDomain(900)).toBe(2024);
    expect(scale.toDomain(450)).toBeCloseTo(2019.5);
  });

  it('round-trips any value in the domain', () => {
    for (const year of [2015, 2018, 2021, 2024]) {
      expect(scale.toDomain(scale.toRange(year))).toBeCloseTo(year);
    }
  });

  it('clamps a value below the domain', () => {
    expect(scale.toRange(1900)).toBe(0);
  });

  it('clamps a value above the domain', () => {
    expect(scale.toRange(3000)).toBe(900);
  });

  it('clamps a position outside the range', () => {
    expect(scale.toDomain(-50)).toBe(2015);
    expect(scale.toDomain(9999)).toBe(2024);
  });

  it('collapses a zero-width domain to the range start rather than dividing by zero', () => {
    const flat = createLinearScale([2020, 2020], [0, 900]);
    expect(flat.toRange(2020)).toBe(0);
    expect(Number.isFinite(flat.toRange(2020))).toBe(true);
    expect(flat.toDomain(450)).toBe(2020);
  });

  it('collapses a zero-width range without producing NaN', () => {
    const flat = createLinearScale([0, 100], [50, 50]);
    expect(flat.toDomain(50)).toBe(0);
    expect(flat.toRange(50)).toBe(50);
  });

  it('handles an inverted range, so a scale can run bottom-up', () => {
    const inverted = createLinearScale([0, 100], [500, 0]);
    expect(inverted.toRange(0)).toBe(500);
    expect(inverted.toRange(100)).toBe(0);
    expect(inverted.toDomain(500)).toBe(0);
  });

  it('exposes its domain and range', () => {
    expect(scale.domain).toEqual([2015, 2024]);
    expect(scale.range).toEqual([0, 900]);
  });
});

describe('snapToStep', () => {
  it('snaps to the nearest step', () => {
    expect(snapToStep(2019.4, 2015, 1)).toBe(2019);
    expect(snapToStep(2019.6, 2015, 1)).toBe(2020);
  });

  it('is exact on a step boundary', () => {
    expect(snapToStep(2020, 2015, 1)).toBe(2020);
  });

  it('honours a step larger than one', () => {
    expect(snapToStep(2018, 2010, 5)).toBe(2020);
    expect(snapToStep(2012, 2010, 5)).toBe(2010);
  });

  it('returns the value unchanged for a non-positive step', () => {
    expect(snapToStep(2019.4, 2015, 0)).toBe(2019.4);
    expect(snapToStep(2019.4, 2015, -1)).toBe(2019.4);
  });
});
