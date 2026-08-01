import { categoryColor } from '@/core/chart/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import type { DetailCategory } from '@/hooks/useRegionDetail.js';
import styles from './RegionDetail.module.css';

export interface RegionCategoryListProps {
  categories: readonly DetailCategory[];
  /** The dataset's own order, which is what fixes each category's colour. */
  order: readonly CrimeCategory[];
}

/**
 * The region's categories as a table.
 *
 * A table rather than a list because it is three aligned columns of numbers,
 * and because it doubles as the accessible equivalent of the donut beside it.
 */
export function RegionCategoryList({ categories, order }: RegionCategoryListProps) {
  const strings = useStrings();

  // Keyed off the dataset's own order, exactly as the donut does, so the two
  // agree. Colour follows the category, never its rank in this table.
  const colorById = new Map(order.map((category, index) => [
    category.id,
    category.color ?? categoryColor(index),
  ]));

  return (
    <table className={styles.table}>
      <caption className={styles.tableCaption}>{strings.detail.categories}</caption>
      <tbody>
        {categories.map((category) => (
          <tr key={category.id} className={styles.row}>
            <td className={styles.swatchCell}>
              <span
                className={styles.swatch}
                style={{ background: colorById.get(category.id) }}
                aria-hidden="true"
              />
            </td>
            <th scope="row" className={styles.rowLabel}>{category.label}</th>
            <td className={styles.rowValue}>{formatTrNumber(category.value)}</td>
            <td className={styles.rowShare}>{formatPercent(category.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
