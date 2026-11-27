import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StickyActionCard } from './StickyActionCard';

describe('StickyActionCard', () => {
  it('shows the summary and fires the primary action', () => {
    const onAction = jest.fn();
    render(<StickyActionCard summaryLabel="Total" summaryValue="$59.00" actionLabel="Pay & start" onAction={onAction} />);
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('$59.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay & start' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('disables the action while loading or disabled', () => {
    const onAction = jest.fn();
    const { rerender } = render(<StickyActionCard actionLabel="Go" onAction={onAction} loading />);
    expect((screen.getByRole('button', { name: 'Go' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<StickyActionCard actionLabel="Go" onAction={onAction} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('pins itself to the viewport bottom', () => {
    render(<StickyActionCard actionLabel="Go" onAction={() => undefined} testId="sticky" />);
    expect(getComputedStyle(screen.getByTestId('sticky')).position).toBe('fixed');
  });
});
