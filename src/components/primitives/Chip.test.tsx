import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip.js';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip label="Hırsızlık" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /Hırsızlık/u })).toBeInTheDocument();
  });

  it('reports selection through aria-pressed, not colour alone', () => {
    const { rerender } = render(<Chip label="A" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<Chip label="A" selected onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<Chip label="A" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a count beside the label when given one', () => {
    render(<Chip label="A" selected={false} onToggle={() => {}} count="1.234" />);
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('carries its category colour as a swatch', () => {
    const { container } = render(
      <Chip label="A" selected={false} onToggle={() => {}} color="#ff0000" />,
    );
    const swatch = container.querySelector('[data-role="swatch"]') as HTMLElement;
    expect(swatch.style.background).toBe('rgb(255, 0, 0)');
  });

  it('renders no swatch when no colour is given', () => {
    const { container } = render(<Chip label="A" selected={false} onToggle={() => {}} />);
    expect(container.querySelector('[data-role="swatch"]')).toBeNull();
  });

  it('marks itself highlighted so a hovered pie slice can point at it', () => {
    const { container } = render(
      <Chip label="A" selected={false} onToggle={() => {}} highlighted />,
    );
    expect(container.querySelector('[data-highlighted="true"]')).not.toBeNull();
  });
});
