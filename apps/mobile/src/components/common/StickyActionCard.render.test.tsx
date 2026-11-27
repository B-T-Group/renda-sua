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
