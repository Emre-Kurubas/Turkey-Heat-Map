import { describe, expectTypeOf, it } from 'vitest';
import type { CrimeRecord, FilterSet, NormalizedRecord, Transform } from './index.js';

describe('core type vocabulary', () => {
  it('CrimeRecord.ilceCode is optional, NormalizedRecord.ilceCode is nullable', () => {
    expectTypeOf<CrimeRecord['ilceCode']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NormalizedRecord['ilceCode']>().toEqualTypeOf<string | null>();
  });

  it('FilterSet.yearRange is a fixed-length pair', () => {
    expectTypeOf<FilterSet['yearRange']>().toEqualTypeOf<[number, number]>();
  });

  it('Transform carries exactly k, x, y', () => {
    expectTypeOf<Transform>().toEqualTypeOf<{ k: number; x: number; y: number }>();
  });
});
