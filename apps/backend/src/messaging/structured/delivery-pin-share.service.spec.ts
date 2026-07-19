import { DeliveryPinShareService } from './delivery-pin-share.service';

describe('DeliveryPinShareService', () => {
  let service: DeliveryPinShareService;

  beforeEach(() => {
    service = new DeliveryPinShareService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('coalesces concurrent shares for the same order', async () => {
    let resolveShare!: (message: { id: string }) => void;
    const pendingShare = new Promise<{ id: string }>((resolve) => {
      resolveShare = resolve;
    });
    const shareOnce = jest
      .spyOn(service as any, 'shareDeliveryPinOnce')
      .mockReturnValue(pendingShare);

    const first = service.shareDeliveryPin('order-1');
    const second = service.shareDeliveryPin('order-1');
    resolveShare({ id: 'message-1' });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: 'message-1' },
      { id: 'message-1' },
    ]);
    expect(shareOnce).toHaveBeenCalledTimes(1);
  });

  it('allows another share after the inflight request settles', async () => {
    const shareOnce = jest
      .spyOn(service as any, 'shareDeliveryPinOnce')
      .mockResolvedValueOnce({ id: 'message-1' })
      .mockResolvedValueOnce({ id: 'message-2' });

    await expect(service.shareDeliveryPin('order-1')).resolves.toEqual({
      id: 'message-1',
    });
    await expect(service.shareDeliveryPin('order-1')).resolves.toEqual({
      id: 'message-2',
    });
    expect(shareOnce).toHaveBeenCalledTimes(2);
  });

  it('clears a failed inflight request so the client can retry', async () => {
    const shareOnce = jest
      .spyOn(service as any, 'shareDeliveryPinOnce')
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce({ id: 'message-1' });

    await expect(service.shareDeliveryPin('order-1')).rejects.toThrow(
      'insert failed'
    );
    await expect(service.shareDeliveryPin('order-1')).resolves.toEqual({
      id: 'message-1',
    });
    expect(shareOnce).toHaveBeenCalledTimes(2);
  });
});
