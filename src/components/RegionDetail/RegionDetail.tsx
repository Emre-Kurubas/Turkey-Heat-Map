import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CategoryPieChart } from '@/components/CategoryPieChart/index.js';
import { TrendChart } from '@/components/TrendChart/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import type { RegionDetailData } from '@/hooks/useRegionDetail.js';
import { RegionCategoryList } from './RegionCategoryList.js';
import { RegionChildList } from './RegionChildList.js';
import styles from './RegionDetail.module.css';

/** How many districts a province's panel lists. */
const TOP_CHILDREN = 10;

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
  const isProvince = detail.level === 'il';

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
      {/*
        Place and size on one line, exactly as the rail states the country and
        its total. Drilling into a region should change the numbers, not the
        shape they are written in.

        The "Toplam" label is kept for screen readers only: on the page the
        number sits beside a place name on a crime map and needs no introduction,
        but read aloud on its own it would be a bare figure.
      */}
      <header className={styles.header}>
        <h2 className={styles.name}>{detail.name}</h2>
        <p className={styles.total} data-role="scope-total">
          <span className="hm-visually-hidden">{strings.detail.total}</span>
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
        /*
         * The year series first, as in the left rail, then whatever the level
         * has underneath it.
         *
         * A province gets two more bands, because its list and its donut are
         * different cuts: districts below it, categories across it. A district
         * gets one, because its list and its donut are the *same* cut — the
         * donut is the shape of the table and the table is the numbers behind
         * the donut. Ruling a line between them would be separating a drawing
         * from its own key.
         */
        <div className={styles.body}>
          {/* Each band wrapped, exactly as in the left rail: the divider has to
              live on a plain element, because a flat GlassPanel's `border: 0`
              sits at the same specificity and would cancel it. */}
          <div className={styles.band}>
            <TrendChart embedded byYear={detail.byYear} />
          </div>

          {/* Holds room for ten rows however few it draws, which is what keeps
              the panel the same height from one region to the next. */}
          <div className={`${styles.band} ${styles.listBand}`}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {isProvince ? strings.detail.districts : strings.detail.categories}
              </h3>
              {isProvince ? (
                <RegionChildList districts={detail.children.slice(0, TOP_CHILDREN)} />
              ) : (
                <div className={styles.pairing} data-role="category-pairing">
                  {/* Drawing on the left, its numbers on the right. */}
                  <CategoryPieChart
                    embedded
                    categories={categories}
                    totals={totals}
                    regionName={detail.name}
                    onHoverCategory={() => {}}
                    // The table beside it is the key, and a better one: it lists
                    // every category rather than folding the small ones into
                    // "Diğer".
                    showLegend={false}
                  />
                  <RegionCategoryList categories={detail.categories} order={categories} />
                </div>
              )}
            </section>
          </div>

          {isProvince ? (
            <div className={styles.band}>
              {/* Embedded: a bordered card inside a bordered panel reads as a
                  rendering fault, not as depth. */}
              <CategoryPieChart
                embedded
                legendPlacement="beside"
                categories={categories}
                totals={totals}
                regionName={detail.name}
                onHoverCategory={() => {}}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
