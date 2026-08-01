/**
 * Categorical hues for the charts, in fixed order.
 *
 * Stepped for a **light** surface and validated as a set against the panel
 * background (`#f7f8fa`): every slot sits in the L 0.43–0.77 band, clears the
 * chroma floor, and the worst adjacent pair measures ΔE 9.1 under simulated
 * colour-vision deficiency and 19.6 under normal vision.
 *
 * Three slots — aqua (2.65), yellow (2.04) and magenta (2.53) — fall below 3:1
 * against the surface. That is legal here and only here: the pie's legend
 * prints a label and a number beside every swatch, so no slice depends on
 * colour alone. Strip those labels and this becomes a real defect.
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
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
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
