import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlassPanel } from './GlassPanel.js';

describe('GlassPanel', () => {
  it('renders its children', () => {
    render(<GlassPanel>İçerik</GlassPanel>);
    expect(screen.getByText('İçerik')).toBeInTheDocument();
  });

  it('exposes an accessible name when given a label', () => {
    render(<GlassPanel label="Gösterge">İçerik</GlassPanel>);
    expect(screen.getByRole('group', { name: 'Gösterge' })).toBeInTheDocument();
  });

  it('is not labelled as a group when no label is given', () => {
    render(<GlassPanel>İçerik</GlassPanel>);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('appends a consumer className rather than replacing its own', () => {
    const { container } = render(<GlassPanel className="ekstra">İçerik</GlassPanel>);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toContain('ekstra');
    expect(panel.className.split(' ').length).toBeGreaterThan(1);
  });
});
