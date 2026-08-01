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
    const { onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    // One third across a 9-year span is 2018.
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('ignores pointer movement when no handle is being dragged', () => {
    const { onChange } = renderSlider();
    const [low] = screen.getAllByRole('slider');
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: 100 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops dragging on pointer up', () => {
    const { onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    fireEvent.pointerUp(low!, { pointerId: 1 });
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a right-click on a handle', () => {
    const { onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 2 });
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
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

describe('RangeSlider — a drag follows the button, not the cursor', () => {
  /**
   * The behaviour this whole section exists for. The previous implementation
   * listened for movement on the 20px-tall track and cancelled the drag on
   * `pointerleave`: the moment the cursor drifted above or below that strip the
   * handle stuck, which is what made dragging feel like it kept slipping.
   */
  it('captures the pointer on the handle it grabbed', () => {
    const captured: number[] = [];
    const spy = vi.spyOn(Element.prototype, 'setPointerCapture')
      .mockImplementation((id: number) => { captured.push(id); });

    renderSlider([2015, 2024]);
    fireEvent.pointerDown(screen.getAllByRole('slider')[0]!, {
      pointerId: 7, clientX: 0, button: 0,
    });

    spy.mockRestore();
    expect(captured).toEqual([7]);
  });

  it('keeps tracking while the cursor is far outside the track', () => {
    const { onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    // Well below the 20px track, where a pointerleave-based drag would have
    // given up several hundred pixels ago.
    fireEvent.pointerMove(low!, {
      pointerId: 1, clientX: TRACK_WIDTH / 3, clientY: 600,
    });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('clamps to the ends rather than running off with the cursor', () => {
    const { onChange } = renderSlider([2018, 2021]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: -5000 });
    expect(onChange).toHaveBeenCalledWith([2015, 2021]);
  });

  it('will not let a dragged handle cross its partner', () => {
    const { onChange } = renderSlider([2018, 2021]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: TRACK_WIDTH });
    expect(onChange).toHaveBeenCalledWith([2021, 2021]);
  });

  it('gives up the drag if the pointer is cancelled', () => {
    const { onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    fireEvent.pointerCancel(low!, { pointerId: 1 });
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the grabbed handle, so the cursor can change under it', () => {
    renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    expect(low).toHaveAttribute('data-dragging', 'true');

    fireEvent.pointerUp(low!, { pointerId: 1 });
    expect(low).toHaveAttribute('data-dragging', 'false');
  });
});

describe('RangeSlider — clicking the track', () => {
  it('moves the nearer handle to the point clicked', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    fireEvent.pointerDown(track, { pointerId: 1, clientX: TRACK_WIDTH / 3, button: 0 });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('moves the high handle when the click is nearer that end', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    fireEvent.pointerDown(track, { pointerId: 1, clientX: TRACK_WIDTH * 0.8, button: 0 });
    expect(onChange).toHaveBeenCalledWith([2015, 2022]);
  });
});

describe('RangeSlider — the tick scale', () => {
  const ticks = (container: HTMLElement): HTMLElement[] =>
    [...container.querySelectorAll('[data-role="tick"]')] as HTMLElement[];

  it('draws none unless asked', () => {
    // A percentage slider has nothing to mark; only a short discrete domain
    // gains anything from a scale.
    const { container } = renderSlider();
    expect(ticks(container)).toHaveLength(0);
  });

  it('draws a divider between each pair of steps when asked', () => {
    const { container } = render(
      <RangeSlider
        min={2015}
        max={2024}
        value={[2015, 2024]}
        onChange={vi.fn()}
        label="Yıl aralığı"
        formatValue={String}
        showTicks
      />,
    );
    // Eight for ten years: one between each adjacent pair, and none under the
    // pill's own rounding where it would be clipped to a sliver.
    expect(ticks(container)).toHaveLength(8);
  });

  it('marks which ticks the selection covers', () => {
    const { container } = render(
      <RangeSlider
        min={2015}
        max={2024}
        value={[2018, 2020]}
        onChange={vi.fn()}
        label="Yıl aralığı"
        formatValue={String}
        showTicks
      />,
    );
    // 2019 and 2020 sit between the handles; the boundaries themselves are
    // marked by the handle stems rather than by a divider.
    const inside = ticks(container).filter((t) => t.dataset['inside'] === 'true');
    expect(inside).toHaveLength(3);
  });

  it('gives up on a domain too long to read as a scale', () => {
    // A hundred marks across 200px is a grey bar, not a scale.
    const { container } = render(
      <RangeSlider
        min={0}
        max={99}
        value={[0, 99]}
        onChange={vi.fn()}
        label="Yüzde"
        formatValue={String}
        showTicks
      />,
    );
    expect(ticks(container)).toHaveLength(0);
  });

  it('draws none for a single-value domain', () => {
    const { container } = render(
      <RangeSlider
        min={2020}
        max={2020}
        value={[2020, 2020]}
        onChange={vi.fn()}
        label="Yıl"
        formatValue={String}
        showTicks
      />,
    );
    expect(ticks(container)).toHaveLength(0);
  });

  it('keeps the ticks out of the accessibility tree', () => {
    // They sit over the track, which is the click target for jumping the
    // nearer handle to a point.
    const { container } = render(
      <RangeSlider
        min={2015}
        max={2024}
        value={[2015, 2024]}
        onChange={vi.fn()}
        label="Yıl aralığı"
        formatValue={String}
        showTicks
      />,
    );
    for (const tick of ticks(container)) expect(tick).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('RangeSlider — the fill reaches the ends', () => {
  /**
   * The trade this settles: the handles run the full width, so a full selection
   * fills the pill edge to edge and takes its rounded caps. Holding the travel
   * inside the corner radius kept the fill square at every position but left a
   * sliver of empty track at each end even at full range, which read as a range
   * that had not quite been opened all the way.
   */
  it('puts the handles on the very ends at full range', () => {
    renderSlider([2015, 2024]);
    const [low, high] = screen.getAllByRole('slider');
    expect(low!.style.left).toBe('0%');
    expect(high!.style.left).toBe('100%');
  });

  it('closes the fill over the whole track at full range', () => {
    const { container } = renderSlider([2015, 2024]);
    const fill = container.querySelector('[class*="fill"]') as HTMLElement;
    expect(fill.style.left).toBe('0%');
    expect(fill.style.right).toBe('0%');
  });

  it('measures a drag against the whole track', () => {
    const { onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0, button: 0 });
    // Dead centre of a nine-year span is 2019.5, which snaps up.
    fireEvent.pointerMove(low!, { pointerId: 1, clientX: TRACK_WIDTH / 2 });
    expect(onChange).toHaveBeenCalledWith([2020, 2024]);
  });
});

describe('RangeSlider — the stems clip to the track', () => {
  /**
   * Drawn on the button, a stem spanned the track's full depth wherever it sat,
   * so at either end it stood proud of the pill's rounded cap — a straight bar
   * poking out of a curve. Drawn inside the groove it is cut to the pill's own
   * silhouette and shortens into the curve exactly as the fill does.
   */
  const stems = (container: HTMLElement): HTMLElement[] =>
    [...container.querySelectorAll('[data-role="stem"]')] as HTMLElement[];

  it('draws one stem per handle', () => {
    const { container } = renderSlider([2018, 2021]);
    expect(stems(container)).toHaveLength(2);
  });

  it('puts them inside the element that clips, not on the buttons', () => {
    const { container } = renderSlider();
    for (const stem of stems(container)) {
      expect(stem.closest('[class*="groove"]')).not.toBeNull();
      expect(stem.closest('[role="slider"]')).toBeNull();
    }
  });

  it('lands them on the same offsets as the handles', () => {
    const { container } = renderSlider([2018, 2021]);
    const handles = screen.getAllByRole('slider');
    expect(stems(container).map((s) => s.style.left))
      .toEqual(handles.map((h) => h.style.left));
  });

  it('keeps them out of the pointer path, so the track click still works', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    fireEvent.pointerDown(track, { pointerId: 1, clientX: TRACK_WIDTH / 3, button: 0 });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });
});
