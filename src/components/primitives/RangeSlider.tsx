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
}

type Handle = 'low' | 'high';

/**
 * Dual-handle range slider over a discrete domain.
 *
 * Each handle is a real `role="slider"` with its own bounds, so the pair is
 * fully keyboard-operable and screen readers announce which end is moving.
 * The handles bound each other rather than being allowed to cross and swap —
 * swapping mid-drag makes the control feel like it slipped out of your hand.
 */
export function RangeSlider({
  min, max, value, onChange, label, formatValue,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const [low, high] = value;

  const percent = (v: number): number => createLinearScale([min, max], [0, 100]).toRange(v);

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

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (dragging === null || track === null) return;

    const rect = track.getBoundingClientRect();
    const scale = createLinearScale([min, max], [rect.left, rect.right]);
    emit(dragging, snapToStep(scale.toDomain(event.clientX), min, 1));
  }, [dragging, min, max, emit]);

  const handleProps = (handle: Handle) => ({
    type: 'button' as const,
    role: 'slider',
    className: styles.handle,
    'aria-label': label,
    'aria-valuenow': handle === 'low' ? low : high,
    'aria-valuemin': handle === 'low' ? min : low,
    'aria-valuemax': handle === 'low' ? high : max,
    'aria-valuetext': formatValue(handle === 'low' ? low : high),
    style: { left: `${percent(handle === 'low' ? low : high)}%` },
    onPointerDown: () => { setDragging(handle); },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => { onKeyDown(event, handle); },
  });

  return (
    <div className={styles.wrapper} role="group" aria-label={label}>
      <div className={styles.readout}>
        <span>{formatValue(low)}</span>
        <span>{formatValue(high)}</span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        data-role="track"
        onPointerMove={onPointerMove}
        onPointerUp={() => { setDragging(null); }}
        onPointerLeave={() => { setDragging(null); }}
      >
        <span className={styles.rail} />
        <span
          className={styles.fill}
          style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
        />
        <button {...handleProps('low')} />
        <button {...handleProps('high')} />
      </div>
    </div>
  );
}
