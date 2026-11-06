import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { PlaceOrderDeliveryWindowBlock } from '../PlaceOrderDeliveryWindowBlock';

jest.mock('../../common/DeliveryWindowPicker', () => {
  const RN = require('react-native');
  return {
    DeliveryWindowPicker: () => <RN.Text>slot-picker</RN.Text>,
  };
});

describe('PlaceOrderDeliveryWindowBlock now vs later', () => {
  it('shows Now and Later as selectable options for pickup', async () => {
    const onCommit = jest.fn();
    const onReadyChange = jest.fn();
    await renderWithProviders(
      <ThemeProvider>
        <PlaceOrderDeliveryWindowBlock
          countryCode="CM"
          stateCode="Littoral"
          enabled
          fulfillment="pickup"
          allowSchedule
          onReadyChange={onReadyChange}
          onCommit={onCommit}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
    expect(screen.queryByText('slot-picker')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('Later'));
    });
    expect(screen.getByText('slot-picker')).toBeTruthy();
    expect(onReadyChange).toHaveBeenCalledWith(false);

    await act(async () => {
      fireEvent.press(screen.getByText('Now'));
    });
    expect(screen.queryByText('slot-picker')).toBeNull();
    expect(onCommit).toHaveBeenCalledWith(null);
    expect(onReadyChange).toHaveBeenCalledWith(true);
  });
});
