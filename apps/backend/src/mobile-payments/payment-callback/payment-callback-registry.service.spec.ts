import { PaymentCallbackRegistryService } from './payment-callback-registry.service';

jest.mock('../../orders/order-payment-callback.handler', () => ({
  OrderPaymentCallbackHandler: class OrderPaymentCallbackHandler {},
}));
jest.mock('../../rentals/rental-payment-callback.handler', () => ({
  RentalPaymentCallbackHandler: class RentalPaymentCallbackHandler {},
}));
jest.mock('../../business-tokens/token-payment-callback.handler', () => ({
  TokenPaymentCallbackHandler: class TokenPaymentCallbackHandler {},
}));

describe('PaymentCallbackRegistryService', () => {
  it('resolves registered payment callback handlers and skips missing ones', () => {
    const orderHandler = { name: 'order' };
    const tokenHandler = { name: 'token' };
    const moduleRef = {
      get: jest.fn((type: { name: string }) => {
        if (type.name === 'OrderPaymentCallbackHandler') return orderHandler;
        if (type.name === 'TokenPaymentCallbackHandler') return tokenHandler;
        return undefined;
      }),
    };

    const service = new PaymentCallbackRegistryService(moduleRef as never);
    const handlers = service.getHandlers();

    expect(handlers).toEqual([orderHandler, tokenHandler]);
    expect(moduleRef.get).toHaveBeenCalledTimes(3);
    expect(moduleRef.get).toHaveBeenCalledWith(expect.any(Function), {
      strict: false,
    });
  });
});
