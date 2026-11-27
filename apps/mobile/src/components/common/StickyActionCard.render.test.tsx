import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { StickyActionCard, type StickyActionCardProps } from './StickyActionCard';

function renderCard(props: Partial<StickyActionCardProps> = {}) {
  return renderWithProviders(
    <ThemeProvider>
      <StickyActionCard actionLabel="Pay & start" onAction={() => undefined} testID="sticky" {...props} />
    </ThemeProvider>
  );
}

describe('StickyActionCard', () => {
  it('shows the summary, note and primary action', async () => {
    await renderCard({ summaryLabel: 'Total', summaryValue: '$59.00', note: 'Nothing is charged yet.' });
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('$59.00')).toBeTruthy();
    expect(screen.getByText('Nothing is charged yet.')).toBeTruthy();
    expect(screen.getByText('Pay & start')).toBeTruthy();
  });

  it('shows the place name and its address below in the place variant', async () => {
    await renderCard({
      summaryVariant: 'place',
      summaryLabel: 'Pickup at',
      summaryValue: 'Stripe Rail',
      summaryDetail: '12 Rue Principale, Montreal, QC, Canada',
    });
    expect(screen.getByText(/Pickup at/)).toBeTruthy();
    expect(screen.getByText('Stripe Rail')).toBeTruthy();
    expect(screen.getByTestId('sticky-summary-address').props.children).toBe('12 Rue Principale, Montreal, QC, Canada');
  });

  it('turns the address into a link that fires its handler', async () => {
    const onSummaryDetailPress = jest.fn();
    await renderCard({
      summaryVariant: 'place',
      summaryLabel: 'Pickup at',
      summaryValue: 'Stripe Rail',
      summaryDetail: '12 Rue Principale',
      onSummaryDetailPress,
      summaryDetailAccessibilityLabel: 'Get directions to 12 Rue Principale',
    });
    expect(screen.getByLabelText('Get directions to 12 Rue Principale').props.accessibilityRole).toBe('link');
    fireEvent.press(screen.getByTestId('sticky-summary-address'));
    expect(onSummaryDetailPress).toHaveBeenCalledTimes(1);
  });

  it('omits the address line when none is given', async () => {
    await renderCard({ summaryVariant: 'place', summaryLabel: 'Pickup at', summaryValue: 'Stripe Rail' });
    expect(screen.queryByTestId('sticky-summary-address')).toBeNull();
  });

  it('fires the action when enabled', async () => {
    const onAction = jest.fn();
    await renderCard({ onAction });
    fireEvent.press(screen.getByText('Pay & start'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not fire the action when disabled', async () => {
    const onAction = jest.fn();
    await renderCard({ onAction, disabled: true });
    fireEvent.press(screen.getByText('Pay & start'));
    expect(onAction).not.toHaveBeenCalled();
  });
});
