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

  it('links the place name to directions and keeps the address as plain text', () => {
    render(
      <StickyActionCard
        summaryVariant="place"
        summaryLabel="Pickup at"
        summaryValue="Stripe Rail"
        summaryDetail="12 Rue Principale"
        summaryValueHref="https://www.google.com/maps/dir/?api=1&destination=12"
        summaryValueLinkLabel="Get directions to Stripe Rail"
        actionLabel="Go"
        onAction={() => undefined}
      />
    );
    const link = screen.getByRole('link', { name: 'Get directions to Stripe Rail' });
    expect(link.getAttribute('href')).toContain('google.com/maps/dir');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toBe('Stripe Rail');
    expect(screen.getByTestId('sticky-summary-address').textContent).toBe('12 Rue Principale');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('pins itself to the viewport bottom', () => {
    render(<StickyActionCard actionLabel="Go" onAction={() => undefined} testId="sticky" />);
    expect(getComputedStyle(screen.getByTestId('sticky')).position).toBe('fixed');
  });
});
