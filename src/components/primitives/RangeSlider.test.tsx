import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RangeSlider } from './RangeSlider.js';

const TRACK_WIDTH = 900;

function renderSlider(value: [number, number] = [2015, 2024], onChange = vi.fn()) {
  const utils = render(
    <RangeSlider
      min={2015}
      max={2024}
      value={value}
      onChange={onChange}
      label="Yıl aralığı"
      formatValue={(v) => String(v)}
    />,
  );
  const track = utils.container.querySelector('[data-role="track"]') as HTMLElement;
  // jsdom gives every element a zero-width rect; the slider reads the track to
  // convert pointer x into a year, so give it a real one.
  track.getBoundingClientRect = () => ({
    left: 0, top: 0, right: TRACK_WIDTH, bottom: 20,
    width: TRACK_WIDTH, height: 20, x: 0, y: 0, toJSON: () => ({}),
  });
  return { ...utils, track, onChange };
}

describe('RangeSlider', () => {
  it('exposes both handles as sliders with their values', () => {
    renderSlider([2018, 2021]);
    const handles = screen.getAllByRole('slider');
    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveAttribute('aria-valuenow', '2018');
    expect(handles[1]).toHaveAttribute('aria-valuenow', '2021');
  });

  it('bounds each handle by the other, so they cannot cross', () => {
    renderSlider([2018, 2021]);
    const [low, high] = screen.getAllByRole('slider');
    expect(low).toHaveAttribute('aria-valuemin', '2015');
    expect(low).toHaveAttribute('aria-valuemax', '2021');
    expect(high).toHaveAttribute('aria-valuemin', '2018');
    expect(high).toHaveAttribute('aria-valuemax', '2024');
  });

  it('moves the low handle right on ArrowRight', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([2019, 2021]);
  });

  it('moves the low handle left on ArrowLeft', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith([2017, 2021]);
  });

  it('moves the high handle too', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[1]!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([2018, 2022]);
  });

  it('does not let the low handle pass the high one', () => {
    const { onChange } = renderSlider([2021, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not let the high handle pass the low one', () => {
    const { onChange } = renderSlider([2021, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[1]!, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('jumps to the ends on Home and End', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith([2015, 2021]);

    fireEvent.keyDown(screen.getAllByRole('slider')[1]!, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('ignores an unrelated key', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'q' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps a pointer drag to whole years', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0 });
    // One third across a 9-year span is 2018.
    fireEvent.pointerMove(track, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('ignores pointer movement when no handle is being dragged', () => {
    const { track, onChange } = renderSlider();
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 100 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops dragging on pointer up', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0 });
    fireEvent.pointerUp(track, { pointerId: 1 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops dragging when the pointer leaves the track', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0 });
    fireEvent.pointerLeave(track, { pointerId: 1 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('labels the group for screen readers', () => {
    renderSlider();
    expect(screen.getByRole('group', { name: 'Yıl aralığı' })).toBeInTheDocument();
  });

  it('shows the formatted endpoints', () => {
    renderSlider([2018, 2021]);
    expect(screen.getByText('2018')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
  });
});
