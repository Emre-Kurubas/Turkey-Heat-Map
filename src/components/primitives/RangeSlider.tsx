import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createLinearScale, snapToStep } from '@/core/chart/index.js';
import styles from './RangeSlider.module.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  /** Accessible name for the pair. */
  label: string;
  formatValue: (value: number) => string;
  /**
   * Defaults to true. Set false where the current range is already written
   * beside the track — printing it twice makes two numbers of one.
   */
  showReadout?: boolean | undefined;
  /**
   * Segments the track by step and writes a scale underneath it.
   *
   * Ignored above `MAX_TICKS` steps, where the dividers touch and the track
   * turns back into a plain bar. Off by default: it only says anything when the
   * domain is discrete and short, which a year range is and a percentage is not.
   */
  showTicks?: boolean | undefined;
}

type Handle = 'low' | 'high';

/** Beyond this the dividers touch and stop reading as segments. */
const MAX_TICKS = 24;

/** Scale labels. More than this and four-digit years start colliding. */
const MAX_LABEL_DIVISIONS = 5;

/**
 * Evenly spaced scale positions that always include both ends.
 *
 * Labelling every step is what the design this follows does, and it works there
 * because its steps are single digits. Years are four, and ten of them do not
 * fit across a 184px track — so this thins them to the coarsest even division
 * that fits, which keeps the labels aligned to real steps rather than to
 * arbitrary fractions of the track.
 */
function labelSteps(min: number, max: number): number[] {
  const span = max - min;
  if (span <= 0) return [min];

  let divisions = 1;
  for (let d = Math.min(MAX_LABEL_DIVISIONS, span); d >= 1; d -= 1) {
    if (span % d === 0) { divisions = d; break; }
  }

  const step = span / divisions;
  return Array.from({ length: divisions + 1 }, (_, i) => min + i * step);
}

/**
 * Dual-handle range slider over a discrete domain.
 *
 * Each handle is a real `role="slider"` with its own bounds, so the pair is
 * fully keyboard-operable and screen readers announce which end is moving.
 * The handles bound each other rather than being allowed to cross and swap —
 * swapping mid-drag makes the control feel like it slipped out of your hand.
 *
 * A drag follows the button, not the pointer's location. `setPointerCapture`
 * on pointerdown routes every later move and the release to the handle itself,
 * so the drag continues while the cursor is above the track, below it, or off
 * the window entirely — and it ends when the button is released and not before.
 * Its predecessor listened on the track and cancelled on `pointerleave`, which
 * meant a drag died the moment the cursor drifted a few pixels off a 20px-tall
 * strip: the handle would stick, and picking it back up felt like a stutter.
 */
export function RangeSlider({
  min, max, value, onChange, label, formatValue,
  showReadout = true, showTicks = false,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const [low, high] = value;

  /**
   * Value → a percentage across the whole track.
   *
   * The handles reach the very ends, so a full selection fills the pill edge to
   * edge and takes its rounded caps. The alternative — holding the travel
   * inside the corner radius so the fill always ended square — kept a sliver of
   * empty track at each end even at full range, and that read as a range that
   * had not quite been opened all the way.
   */
  const percent = (v: number): number => createLinearScale([min, max], [0, 100]).toRange(v);

  const steps = max - min + 1;
  const segmented = showTicks && steps > 1 && steps <= MAX_TICKS;
  /*
   * Dividers between the segments, so neither end sits under the pill's own
   * rounding where it would be clipped to a sliver.
   */
  const ticks = segmented
    ? Array.from({ length: steps - 2 }, (_, i) => min + i + 1)
    : [];
  const scale = segmented ? labelSteps(min, max) : [];

  const emit = useCallback((handle: Handle, next: number) => {
    if (handle === 'low') {
      const clamped = Math.min(Math.max(next, min), high);
      if (clamped !== low) onChange([clamped, high]);
      return;
    }
    const clamped = Math.max(Math.min(next, max), low);
    if (clamped !== high) onChange([low, clamped]);
  }, [low, high, min, max, onChange]);

  const onKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handle: Handle,
  ) => {
    const current = handle === 'low' ? low : high;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        emit(handle, current + 1);
        return;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        emit(handle, current - 1);
        return;
      case 'Home':
        event.preventDefault();
        emit(handle, min);
        return;
      case 'End':
        event.preventDefault();
        emit(handle, max);
        return;
      default:
    }
  }, [low, high, min, max, emit]);

  /** Pointer x → the nearest value on the track. */
  const valueAt = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (track === null) return min;
    const rect = track.getBoundingClientRect();
    // Guard the degenerate case: a track with no width would divide by zero
    // inside the scale, and jsdom reports exactly that.
    if (rect.width === 0) return min;
    return snapToStep(
      createLinearScale([min, max], [rect.left, rect.right]).toDomain(clientX),
      min,
      1,
    );
  }, [min, max]);

  const onPointerDown = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: Handle,
  ) => {
    if (event.button !== 0) return;
    setDragging(handle);
    // From here the handle owns the pointer: moves and the release are
    // delivered to it wherever the cursor goes.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: Handle,
  ) => {
    if (dragging !== handle) return;
    event.preventDefault();
    emit(handle, valueAt(event.clientX));
  }, [dragging, emit, valueAt]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  /** A click anywhere on the track moves the nearer handle to that point. */
  const onTrackDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[role="slider"]')) return;
    const next = valueAt(event.clientX);
    emit(Math.abs(next - low) <= Math.abs(next - high) ? 'low' : 'high', next);
  }, [emit, valueAt, low, high]);

  const handleProps = (handle: Handle) => ({
    type: 'button' as const,
    role: 'slider',
    className: styles.handle,
    'data-handle': handle,
    'data-dragging': dragging === handle ? 'true' : 'false',
    'aria-label': label,
    'aria-valuenow': handle === 'low' ? low : high,
    'aria-valuemin': handle === 'low' ? min : low,
    'aria-valuemax': handle === 'low' ? high : max,
    'aria-valuetext': formatValue(handle === 'low' ? low : high),
    style: { left: `${percent(handle === 'low' ? low : high)}%` },
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      onPointerDown(event, handle);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      onPointerMove(event, handle);
    },
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => { onKeyDown(event, handle); },
  });

  return (
    <div className={styles.wrapper} role="group" aria-label={label}>
      {showReadout ? (
        <div className={styles.readout}>
          <span>{formatValue(low)}</span>
          <span>{formatValue(high)}</span>
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={styles.track}
        data-role="track"
        onPointerDown={onTrackDown}
      >
        {/*
          The pill, and the only thing that clips. The fill inside it is drawn
          with square edges and takes the track's rounding at whichever end it
          reaches — rounding the fill itself would put a curve in the middle of
          the bar wherever a handle happens to sit.
        */}
        <span className={styles.groove}>
          <span
            className={styles.fill}
            style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
          />
          {ticks.map((step) => (
            <span
              key={step}
              className={styles.tick}
              data-role="tick"
              data-inside={step >= low && step <= high ? 'true' : 'false'}
              style={{ left: `${percent(step)}%` }}
              aria-hidden="true"
            />
          ))}

          {/*
            The handle stems live in here, inside the clip, rather than on the
            buttons that carry them.

            That is the whole trick: a stem drawn on the button spans the track's
            full depth wherever it sits, so at either end it stood proud of the
            pill's curve — a straight bar poking out of a rounded cap. Drawn
            inside the groove it is cut to the pill's own silhouette, so it
            shortens into the curve exactly as the fill does. The knob stays out
            on the button, because it is meant to sit proud of the track.
          */}
          {([low, high] as const).map((v, i) => (
            <span
              key={i === 0 ? 'low' : 'high'}
              className={styles.stem}
              data-role="stem"
              style={{ left: `${percent(v)}%` }}
              aria-hidden="true"
            />
          ))}
        </span>

        <button {...handleProps('low')} />
        <button {...handleProps('high')} />
      </div>

      {scale.length === 0 ? null : (
        <div className={styles.scale} aria-hidden="true">
          {scale.map((step, index) => (
            <span
              key={step}
              className={styles.scaleLabel}
              data-role="scale-label"
              data-inside={step >= low && step <= high ? 'true' : 'false'}
              style={{
                left: `${percent(step)}%`,
                // The end labels would otherwise hang off the track.
                transform: index === 0
                  ? 'none'
                  : index === scale.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {formatValue(step)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
