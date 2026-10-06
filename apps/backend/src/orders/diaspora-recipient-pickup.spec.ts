import { OrdersService } from './orders.service';

const readyDiaspora = {
  id: 'order-1',
  order_number: 'ORD-1',
  is_diaspora_order: true,
  fulfillment_method: 'pickup',
  current_status: 'ready_for_pickup',
  payment_status: 'authorized',
};

function harness(order: unknown) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue(order);
  const settle = jest
    .spyOn(service as any, 'settleAuthorizedPickup')
    .mockResolvedValue(undefined);
  return { service, settle };
}

describe('completeDiasporaRecipientPickup', () => {
  it('settles a ready authorized or paid diaspora pickup once', async () => {
    const authorized = harness(readyDiaspora);
    await expect(
      authorized.service.completeDiasporaRecipientPickup('order-1')
    ).resolves.toBe('completed');
    expect(authorized.settle).toHaveBeenCalledTimes(1);
    expect(authorized.settle).toHaveBeenCalledWith(
      readyDiaspora,
      'Order completed by recipient on WhatsApp'
    );

    const paid = harness({ ...readyDiaspora, payment_status: 'paid' });
    await expect(
      paid.service.completeDiasporaRecipientPickup('order-1')
    ).resolves.toBe('completed');
    expect(paid.settle).toHaveBeenCalledTimes(1);
  });

  it('does not settle a missing, unpaid, local, delivery, or not-ready order', async () => {
    const missing = harness(null);
    await expect(
      missing.service.completeDiasporaRecipientPickup('missing')
    ).resolves.toBe('not_allowed');
    expect(missing.settle).not.toHaveBeenCalled();

    const blocked = [
      { ...readyDiaspora, payment_status: 'pending' },
      { ...readyDiaspora, payment_status: null },
      { ...readyDiaspora, is_diaspora_order: false },
      { ...readyDiaspora, is_diaspora_order: null },
      { ...readyDiaspora, fulfillment_method: 'delivery' },
      { ...readyDiaspora, current_status: 'preparing' },
    ];
    for (const order of blocked) {
      const { service, settle } = harness(order);
      await expect(
        service.completeDiasporaRecipientPickup('order-1')
      ).resolves.toBe('not_allowed');
      expect(settle).not.toHaveBeenCalled();
    }
  });

  it('does not settle again when the pickup is already complete', async () => {
    const { service, settle } = harness({
      ...readyDiaspora,
      current_status: 'complete',
    });
    await expect(
      service.completeDiasporaRecipientPickup('order-1')
    ).resolves.toBe('already_complete');
    expect(settle).not.toHaveBeenCalled();
  });

  it('lets a settlement failure reach the WhatsApp caller', async () => {
    const { service, settle } = harness(readyDiaspora);
    settle.mockRejectedValue(new Error('capture failed'));
    await expect(
      service.completeDiasporaRecipientPickup('order-1')
    ).rejects.toThrow('capture failed');
  });
});
