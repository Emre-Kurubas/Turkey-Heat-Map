import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton.js';

describe('IconButton', () => {
  it('exposes its label as the accessible name, since the glyph is decorative', () => {
    render(<IconButton label="Daralt" onClick={() => {}}>«</IconButton>);
    expect(screen.getByRole('button', { name: 'Daralt' })).toBeInTheDocument();
  });

  it('hides the glyph from assistive technology', () => {
    const { container } = render(<IconButton label="Daralt" onClick={() => {}}>«</IconButton>);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('«');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<IconButton label="Daralt" onClick={onClick}>«</IconButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reports a toggle state when given one', () => {
    render(<IconButton label="Daralt" onClick={() => {}} pressed>«</IconButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('omits aria-pressed entirely when it is not a toggle', () => {
    render(<IconButton label="Daralt" onClick={() => {}}>«</IconButton>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });
});
