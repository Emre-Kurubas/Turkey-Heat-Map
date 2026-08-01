import { useMemo, useState } from 'react';
import { CategoryPieChart } from '@/components/CategoryPieChart/index.js';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { TrendChart } from '@/components/TrendChart/index.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import type { ColorScale } from '@/core/color/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import { RegionList } from './RegionList.js';
import styles from './Sidebar.module.css';

/** How many regions the leaderboard shows. */
const TOP_COUNT = 10;

export interface SidebarSections {
  /** The category donut and its key, at the foot of the rail. */
  pie: boolean;
  /** The year series, at the head of the rail. */
  trend: boolean;
  /** The ranked region list, between the two. */
  list: boolean;
}

export interface SidebarProps {
  rows: readonly RankedRegion[];
  scale: ColorScale;
  categories: readonly CrimeCategory[];
  /** Category totals for the active scope — region if one is selected, else national. */
  categoryTotals: ReadonlyMap<string, number>;
  byYear: ReadonlyMap<number, number>;
  /** Records counted under the active filters, across the whole country. */
  total: number;
  /** Selected region name, or null for the national picture. */
  regionName: string | null;
  onHoverCategory: (id: string | null) => void;
  sections: SidebarSections;
}

/**
 * The left rail: the year series, the leaderboard, then the category donut.
 *
 * The charts used to float in the top-right and right corners of the map, one
 * card each. Gathering them here is what makes the rail readable as a single
 * answer to "what does the current filter show": the line breaks the total down
 * by year, the list breaks it down by place, the donut breaks it down by
 * category — three cuts of one number, in one column, rather than three cards
 * to find around the edge of the map.
 *
 * The map keeps everything to the right of it and is never covered.
 */
export function Sidebar({
  rows, scale, categories, categoryTotals, byYear, total, regionName,
  onHoverCategory, sections,
}: SidebarProps) {
  const strings = useStrings();

  // Collapse is this panel's own affair — no other panel reads it, so it stays
  // out of the shared store.
  const [collapsed, setCollapsed] = useState(false);

  /*
   * The top ten by count, in that order.
   *
   * There was an alphabetical sort toggle here. On a list of ten it earned
   * nothing: the whole point of a leaderboard is the ranking, and rearranging
   * it into name order leaves the same ten rows saying less.
   */
  const top = useMemo(() => rows.slice(0, TOP_COUNT), [rows]);

  /*
   * The handle lives outside the panel, not in its header.
   *
   * Inside, it went with the panel when the panel left: collapsing slid a 380px
   * card off the left edge and took the only way back with it. Out here it is a
   * sibling in the same flex row, so it stays put — and while collapsed it is
   * the only thing left in the rail's column, a tab peeking off the edge of the
   * map.
   */
  return (
    <div className={styles.rail} data-collapsed={collapsed ? 'true' : 'false'}>
      {/*
        Hidden from assistive tech while collapsed, but still mounted: the CSS
        delays `visibility: hidden` until the slide finishes, so there is
        something to animate in both directions. Unmounting would make the
        panel blink out and return from a standing start.
      */}
      <GlassPanel
        label={strings.sidebar.title}
        className={styles.sidebar}
        {...(collapsed ? { 'aria-hidden': true as const } : {})}
      >
        {/*
          The scope and its size, on one line: this is the country, and this is
          how many records the current filters leave in it. The heading named
          the panel and said nothing about the data, which left the reader with
          three breakdowns of a number that was never stated.
        */}
        <div className={styles.header}>
          <h2 className={styles.title}>{strings.sidebar.title}</h2>
          <p className={styles.total} data-role="scope-total">
            <span className="hm-visually-hidden">{strings.detail.total}</span>
            <span className={styles.totalValue}>{formatTrNumber(total)}</span>
          </p>
        </div>

        {/*
          Time, then place, then category — narrowing all the way down. The year
          series answers "is this getting worse", which is the question that
          comes before "where" and "of what", and the donut sits at the bottom
          because its key is a reference to consult rather than a shape to read.

          Each section is wrapped rather than being a `.body` child directly.
          The rules between them are drawn on those wrappers, and they have to
          be: a chart's own root is a flat GlassPanel, whose `border: 0` sits at
          the same specificity as the divider rule and cancelled it depending on
          which stylesheet the bundler emitted last. The line above the donut
          came and went for exactly that reason. The wrapper also owns the
          padding, so every band has the same space above and below its content
          and the rule lands midway between two sections rather than hugging one.
        */}
        <div className={styles.body}>
          {sections.trend ? (
            <div className={styles.section}>
              <TrendChart embedded byYear={byYear} />
            </div>
          ) : null}

          {/*
            Its own group, named by its own heading. The rail's label covers
            the whole surface, so without this the leaderboard would be
            announced as part of "Türkiye" alongside two charts — and the
            `sidebar` panel flag would have nothing of its own to switch.
          */}
          {sections.list ? (
            <div className={styles.section}>
              <section
                className={styles.listSection}
                role="group"
                aria-label={strings.sidebar.topList}
              >
                <h3 className={styles.sectionTitle}>{strings.sidebar.topList}</h3>
                <RegionList rows={top} scale={scale} />
              </section>
            </div>
          ) : null}

          {sections.pie ? (
            <div className={styles.section}>
              <CategoryPieChart
                embedded
                legendPlacement="beside"
                categories={categories}
                totals={categoryTotals}
                regionName={regionName}
                onHoverCategory={onHoverCategory}
              />
            </div>
          ) : null}
        </div>
      </GlassPanel>

      <button
        type="button"
        className={styles.handle}
        data-role="rail-toggle"
        aria-expanded={!collapsed}
        aria-label={collapsed ? strings.sidebar.expand : strings.sidebar.collapse}
        onClick={() => { setCollapsed((v) => !v); }}
      >
        <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
      </button>
    </div>
  );
}
