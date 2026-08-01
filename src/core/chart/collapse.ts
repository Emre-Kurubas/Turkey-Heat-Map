export interface Slice {
  id: string;
  label: string;
  value: number;
}

export interface CollapsedSlice extends Slice {
  /** Fraction of the total, 0..1. */
  share: number;
  isOther: boolean;
  /** Ids folded into this slice. A single id for an ordinary slice. */
  members: readonly string[];
}

export interface CollapseOptions {
  /** Slices below this share fold into "other". */
  minShare: number;
  /** Hard ceiling on rendered slices, including "other". */
  maxSlices: number;
  otherLabel: string;
}

/**
 * Orders slices largest-first and folds the tail into a single "other".
 *
 * Two rules, not one. The share floor removes slivers too thin to see. The
 * count cap exists because a share floor alone does not bound the slice count:
 * eight categories at 12% each all clear a 3% floor, and a donut of eight
 * near-equal wedges cannot be read. Past roughly six segments, adjacent hues
 * blur and the chart stops answering its question.
 *
 * A tail of exactly one is never folded — hiding one category's name behind
 * "other" costs information and saves nothing.
 */
export function collapseSlices(
  slices: readonly Slice[],
  options: CollapseOptions,
): CollapsedSlice[] {
  const { minShare, maxSlices, otherLabel } = options;

  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return [];

  const ordered = [...positive].sort((a, b) => b.value - a.value);

  const keep: Slice[] = [];
  const fold: Slice[] = [];
  for (const slice of ordered) {
    const belowFloor = slice.value / total < minShare;
    // Reserve the last visible position for "other" once folding is inevitable.
    const overCap = keep.length >= maxSlices - 1 && ordered.length > maxSlices;
    if (belowFloor || overCap) fold.push(slice);
    else keep.push(slice);
  }

  // A tail of one keeps its own identity.
  if (fold.length === 1) {
    keep.push(fold[0]!);
    fold.length = 0;
  }

  const out: CollapsedSlice[] = keep.map((slice) => ({
    ...slice,
    share: slice.value / total,
    isOther: false,
    members: [slice.id],
  }));

  if (fold.length > 0) {
    const value = fold.reduce((sum, slice) => sum + slice.value, 0);
    out.push({
      id: '__other__',
      label: otherLabel,
      value,
      share: value / total,
      isOther: true,
      members: fold.map((slice) => slice.id),
    });
  }

  return out;
}
