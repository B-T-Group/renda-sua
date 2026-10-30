import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { PlaceOrderDeliveryWindowBlock } from '../PlaceOrderDeliveryWindowBlock';
import type { DedicatedCoveredSlot } from '../../../types/checkout';
import type { ClientDeliveryWindowPayload } from '../../../types/deliveryWindow';

// The standard picker pulls in the API client (expo-secure-store → native
// modules), which the render-test env can't resolve. This test only exercises
// the covered-slot path, so stub it out.
jest.mock('../../common/DeliveryWindowPicker', () => ({
  DeliveryWindowPicker: () => null,
}));

const SLOTS: DedicatedCoveredSlot[] = [
  { date: '2026-10-30', slot_id: 'evening-id', slot_key: 'evening', start: '16:00', end: '20:00', pickup_time: '16:30' },
];

/**
 * Mirrors PlaceOrderScreen / CartCheckoutScreen: the window resets in an
 * effect on fulfillment change, and the block mounts in that same commit.
 */
function Harness({ passValue, onWindow }: { passValue: boolean; onWindow: (w: ClientDeliveryWindowPayload | null) => void }) {
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryWindow, setDeliveryWindow] = useState<ClientDeliveryWindowPayload | null>(null);
  useEffect(() => {
    setDeliveryWindow(null);
  }, [fulfillment]);
  useEffect(() => {
    onWindow(deliveryWindow);
  }, [deliveryWindow, onWindow]);
  const onCommit = useCallback((w: ClientDeliveryWindowPayload | null) => setDeliveryWindow(w), []);
  return (
    <>
      <Pressable onPress={() => setFulfillment('delivery')}>
        <Text>choose-delivery</Text>
      </Pressable>
      {fulfillment === 'delivery' ? (
        <PlaceOrderDeliveryWindowBlock
          countryCode="CA"
          stateCode="Quebec"
          enabled
          coveredSlots={SLOTS}
          {...(passValue ? { value: deliveryWindow } : {})}
          onReadyChange={() => undefined}
          onCommit={onCommit}
        />
      ) : null}
    </>
  );
}

describe('PlaceOrderDeliveryWindowBlock covered slots', () => {
  it('keeps the default covered slot committed when the screen resets its window on switching to delivery', async () => {
    let last: ClientDeliveryWindowPayload | null = null;
    await renderWithProviders(<Harness passValue onWindow={(w) => (last = w)} />);
    await act(async () => {
      fireEvent.press(screen.getByText('choose-delivery'));
    });
    expect(last).toEqual({ slot_id: 'evening-id', preferred_date: '2026-10-30' });
  });
});
