import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CategoryPieChart } from '@/components/CategoryPieChart/index.js';
import { TrendChart } from '@/components/TrendChart/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import type { RegionDetailData } from '@/hooks/useRegionDetail.js';
import { RegionCategoryList } from './RegionCategoryList.js';
import styles from './RegionDetail.module.css';

export interface RegionDetailProps {
  detail: RegionDetailData;
  categories: readonly CrimeCategory[];
  onClose: () => void;
}

export function RegionDetail({ detail, categories, onClose }: RegionDetailProps) {
  const strings = useStrings();
  const ref = useRef<HTMLDivElement | null>(null);

  // Focus the panel on open so Escape reaches it and a screen reader announces
  // the region that was just opened.
  useEffect(() => { ref.current?.focus(); }, [detail.code, detail.level]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  }, [onClose]);

  const totals = useMemo(
    () => new Map(detail.categories.map((category) => [category.id, category.value])),
    [detail.categories],
  );

  const isEmpty = detail.total === 0;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal={false}
      aria-label={detail.name}
      tabIndex={-1}
      className={styles.panel}
      onKeyDown={onKeyDown}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <h2 className={styles.name}>{detail.name}</h2>
          <span className={styles.level}>
            {detail.level === 'il' ? strings.detail.levelIl : strings.detail.levelIlce}
          </span>
        </div>
        <p className={styles.total}>
          <span className={styles.totalLabel}>{strings.detail.total}</span>
          <span className={styles.totalValue}>{formatTrNumber(detail.total)}</span>
        </p>
        <button
          type="button"
          className={styles.close}
          aria-label={strings.detail.close}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {isEmpty ? (
        <p className={styles.empty}>{strings.detail.empty}</p>
      ) : (
        <div className={styles.body}>
          <div className={styles.listColumn}>
            <RegionCategoryList categories={detail.categories} order={categories} />
          </div>
          <CategoryPieChart
            categories={categories}
            totals={totals}
            regionName={detail.name}
            onHoverCategory={() => {}}
            // The table on the left already lists every category and number.
            showLegend={false}
          />
          <TrendChart byYear={detail.byYear} />
        </div>
      )}
    </div>
  );
}
