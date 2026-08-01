/**
 * Categorical hues for the charts, in fixed order.
 *
 * Stepped for a dark surface and validated as a set against the panels'
 * composited background (`#11172b` — the glass fill over the map): every slot
 * sits in the L 0.48–0.67 band, clears the chroma floor, holds >= 3:1 contrast,
 * and the worst adjacent pair measures ΔE 8.4 under simulated colour-vision
 * deficiency and 19.3 under normal vision.
 *
 * **The order is the safety mechanism, not decoration.** Adjacent slots are the
 * pairs a reader compares — neighbouring arcs, neighbouring chips — and the
 * ordering is what keeps those pairs separable. Re-ordering or substituting a
 * hue invalidates the result; re-run the validator if you must.
 *
 * There is deliberately no ninth hue. A generated one is indistinguishable from
 * an existing slot under CVD; the ninth category folds into "Diğer" instead.
 */
export const CATEGORY_PALETTE = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
] as const satisfies readonly `#${string}`[];

/**
 * The colour for a category at a fixed position.
 *
 * Callers must pass the category's index in the dataset's own category list —
 * never its rank in the chart. Ranking the colours would repaint every
 * surviving series whenever a filter changed the order, which reads as the
 * chart re-labelling itself.
 */
export function categoryColor(index: number): string {
  const last = CATEGORY_PALETTE.length - 1;
  if (index < 0) return CATEGORY_PALETTE[0];
  return CATEGORY_PALETTE[index > last ? last : index]!;
}
