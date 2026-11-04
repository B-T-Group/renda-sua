import { deliveryConfirmPath, deliveryConfirmPushData } from './delivery-confirm-link.util';

describe('deliveryConfirmPushData', () => {
  it('targets the client persona confirm screen when awaiting confirmation', () => {
    expect(deliveryConfirmPushData('awaiting_client_confirmation', 'client', 'o1')).toEqual({
      url: '/orders/o1/confirm?persona=client',
      screen: 'delivery-confirm',
      targetPersona: 'client',
      source: 'push',
    });
  });

  it('adds nothing for agents, businesses, or other statuses', () => {
    expect(deliveryConfirmPushData('awaiting_client_confirmation', 'agent', 'o1')).toEqual({});
    expect(deliveryConfirmPushData('out_for_delivery', 'client', 'o1')).toEqual({});
  });

  it('builds the web confirm path', () => {
    expect(deliveryConfirmPath('x')).toBe('/orders/x/confirm?persona=client');
  });
});
