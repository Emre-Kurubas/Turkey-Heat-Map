import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './Attribution.module.css';

/**
 * Data credit.
 *
 * The boundary data is ODbL/CC-BY-SA, which makes attribution a licence
 * condition rather than a courtesy. It is styleable but always rendered — there
 * is deliberately no prop to remove it.
 */
export function Attribution() {
  const strings = useStrings();
  return (
    <p role="note" aria-label={strings.attribution.label} className={styles.attribution}>
      {strings.attribution.text}
    </p>
  );
}
