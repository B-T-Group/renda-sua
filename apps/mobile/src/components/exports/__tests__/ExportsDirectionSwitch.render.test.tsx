import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ExportsDirectionSwitch } from '../ExportsDirectionSwitch';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockCopy = jest.fn().mockResolvedValue(true);
jest.mock('../../../hooks/usePageShare', () => ({
  usePageShare: () => ({
    canUseNativeShare: false,
    shareNative: jest.fn(),
    openChannel: jest.fn(),
    copyToClipboard: mockCopy,
  }),
}));

const origins = [
  { country_code: 'CA', item_count: 38, business_count: 4, destination_codes: ['CD', 'CG', 'CI', 'CM', 'GA', 'PH'] },
  { country_code: 'CM', item_count: 124, business_count: 9, destination_codes: ['GA'] },
];

async function renderSwitch(props: Partial<React.ComponentProps<typeof ExportsDirectionSwitch>> = {}) {
  const onChangeDirection = jest.fn();
  const onPickOrigin = jest.fn();
  await renderWithProviders(
    <ThemeProvider>
      <ExportsDirectionSwitch
        direction="from"
        marketCode="CA"
        originCode="CA"
        origins={origins}
        onChangeDirection={onChangeDirection}
        onPickOrigin={onPickOrigin}
        {...props}
      />
    </ThemeProvider>
  );
  return { onChangeDirection, onPickOrigin };
}

describe('ExportsDirectionSwitch', () => {
  it('shows Into / From for the viewer market and the origin summary', async () => {
    await renderSwitch({ total: 38 });
    expect(screen.getByText('Into Canada')).toBeTruthy();
    expect(screen.getByText('From Canada')).toBeTruthy();
    expect(screen.getByText('38 products · ships to 6 markets')).toBeTruthy();
  });

  it('switches direction without touching the market', async () => {
    const { onChangeDirection, onPickOrigin } = await renderSwitch({ direction: 'into' });
    await fireEvent.press(screen.getByTestId('exports-direction-from'));
    expect(onChangeDirection).toHaveBeenCalledWith('from');
    expect(onPickOrigin).not.toHaveBeenCalled();
    // Into view has no origin chip
    expect(screen.queryByTestId('exports-origin-chip')).toBeNull();
  });

  it('origin picker lists only origins with counts; picking one reports the origin only', async () => {
    const { onPickOrigin } = await renderSwitch();
    await fireEvent.press(screen.getByTestId('exports-origin-chip'));
    expect(screen.getByText('Exported from')).toBeTruthy();
    expect(screen.getByText('See what each market exports. Your market stays Canada.')).toBeTruthy();
    expect(screen.getByText('38 items')).toBeTruthy();
    expect(screen.getByText('124 items')).toBeTruthy();
    expect(screen.queryByText('Gabon')).toBeNull();
    await fireEvent.press(screen.getByTestId('exports-origin-option-CM'));
    expect(onPickOrigin).toHaveBeenCalledWith('CM');
  });

  it('copies the public /exports/{cc} link', async () => {
    await renderSwitch();
    await fireEvent.press(screen.getByTestId('exports-origin-chip'));
    await fireEvent.press(screen.getByTestId('exports-copy-public-link'));
    expect(mockCopy).toHaveBeenCalledWith(expect.stringMatching(/\/exports\/ca$/));
  });
});
