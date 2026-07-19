import type { OrderMessage } from '../messaging.types';
import { DeliveryPinShareService } from './delivery-pin-share.service';

type TestableService = {
  shareDeliveryPinOnce(orderId: string): Promise<OrderMessage>;
};

const message = (id: string): OrderMessage => ({
  id,
  user_id: 'client-1',
  entity_type: 'order',
  entity_id: 'order-1',
  message: 'PIN shared',
  created_at: '2026-07-19T10:00:00.000Z',
  updated_at: '2026-07-19T10:00:00.000Z',
});

describe('DeliveryPinShareService', () => {
  let service: DeliveryPinShareService;
  let testableService: TestableService;

  beforeEach(() => {
    service = new DeliveryPinShareService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    testableService = service as unknown as TestableService;
  });

  it('coalesces concurrent shares for the same order', async () => {
    let resolveShare!: (value: OrderMessage) => void;
    const pendingShare = new Promise<OrderMessage>((resolve) => {
      resolveShare = resolve;
    });
    const shareOnce = jest
      .spyOn(testableService, 'shareDeliveryPinOnce')
      .mockReturnValue(pendingShare);
    const created = message('message-1');

    const first = service.shareDeliveryPin('order-1');
    const second = service.shareDeliveryPin('order-1');
    resolveShare(created);

    await expect(Promise.all([first, second])).resolves.toEqual([
      created,
      created,
    ]);
    expect(shareOnce).toHaveBeenCalledTimes(1);
  });

  it('allows another share after the inflight request settles', async () => {
    const firstMessage = message('message-1');
    const secondMessage = message('message-2');
    const shareOnce = jest
      .spyOn(testableService, 'shareDeliveryPinOnce')
      .mockResolvedValueOnce(firstMessage)
      .mockResolvedValueOnce(secondMessage);

    await expect(service.shareDeliveryPin('order-1')).resolves.toBe(
      firstMessage
    );
    await expect(service.shareDeliveryPin('order-1')).resolves.toBe(
      secondMessage
    );
    expect(shareOnce).toHaveBeenCalledTimes(2);
  });

  it('clears a failed inflight request so the client can retry', async () => {
    const created = message('message-1');
    const shareOnce = jest
      .spyOn(testableService, 'shareDeliveryPinOnce')
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce(created);

    await expect(service.shareDeliveryPin('order-1')).rejects.toThrow(
      'insert failed'
    );
    await expect(service.shareDeliveryPin('order-1')).resolves.toBe(created);
    expect(shareOnce).toHaveBeenCalledTimes(2);
  });
});
