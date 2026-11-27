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

  it('turns the place name into a link and keeps the address plain', async () => {
    const onSummaryValuePress = jest.fn();
    await renderCard({
      summaryVariant: 'place',
      summaryLabel: 'Pickup at',
      summaryValue: 'Stripe Rail',
      summaryDetail: '12 Rue Principale',
      onSummaryValuePress,
      summaryValueAccessibilityLabel: 'Get directions to Stripe Rail',
    });
    expect(screen.getByLabelText('Get directions to Stripe Rail').props.accessibilityRole).toBe('link');
    expect(screen.getByTestId('sticky-summary-address').props.accessibilityRole).toBeUndefined();
    expect(screen.getByTestId('sticky-summary-address').props.onPress).toBeUndefined();
    fireEvent.press(screen.getByText('Stripe Rail'));
    expect(onSummaryValuePress).toHaveBeenCalledTimes(1);
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
