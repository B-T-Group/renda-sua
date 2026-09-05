import { resolveOrderNotificationAddress } from './order-notification-address.util';

describe('resolveOrderNotificationAddress', () => {
  const pickup = { address_line_1: '12 Store St' };
  const delivery = { address_line_1: '99 Client Ave' };

  it('uses the business location for pickup orders', () => {
    expect(
      resolveOrderNotificationAddress({
        fulfillment_method: 'pickup',
        delivery_address: null,
        business_location: { address: pickup },
      })
    ).toBe(pickup);
  });

  it('uses the client delivery address for delivery orders', () => {
    expect(
      resolveOrderNotificationAddress({
        fulfillment_method: 'delivery',
        delivery_address: delivery,
        business_location: { address: pickup },
      })
    ).toBe(delivery);
  });
});
