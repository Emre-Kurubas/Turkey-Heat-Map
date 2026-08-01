/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * The library forbids `Math.random()` outright: mock data feeds the tests, the
 * playground, and the documentation screenshots, and all three must be
 * byte-reproducible from a seed. A flaky dataset makes every downstream test
 * flaky with it.
 *
 * Not cryptographically secure, and not intended to be.
 */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
