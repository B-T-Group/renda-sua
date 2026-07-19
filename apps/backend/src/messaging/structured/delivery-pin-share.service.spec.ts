import { HttpException, HttpStatus } from '@nestjs/common';
import { DeliveryPinShareService } from './delivery-pin-share.service';
import type { OrderMessage } from '../messaging.types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('DeliveryPinShareService', () => {
  it('authorizes each caller before coalescing PIN share requests', async () => {
    const legitimateClient = {
      id: 'client-user-1',
      user_type_id: 'client',
      client: { id: 'client-1' },
    };
    const otherClient = {
      id: 'client-user-2',
      user_type_id: 'client',
      client: { id: 'client-2' },
    };
    const hasuraUserService = {
      getUser: jest
        .fn()
        .mockResolvedValueOnce(legitimateClient)
        .mockResolvedValueOnce(otherClient),
    };
    const order = {
      id: 'order-1',
      order_number: 'ORD-1',
      business_id: 'business-1',
      client_id: 'client-1',
      assigned_agent_id: 'agent-1',
      client: { user_id: legitimateClient.id },
    };
    const messagingService = {
      loadOrderForMessagingPublic: jest.fn().mockResolvedValue(order),
      assertMessagingAccess: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeliveryPinShareService(
      hasuraUserService as any,
      {} as any,
      messagingService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    const started = deferred<void>();
    const result = deferred<OrderMessage>();
    const sharedMessage = {
      id: 'message-1',
      user_id: legitimateClient.id,
      entity_type: 'order',
      entity_id: order.id,
      message: 'PIN shared',
      created_at: '2026-07-19T00:00:00.000Z',
      updated_at: '2026-07-19T00:00:00.000Z',
      structured_content: { pin: '1234' },
    };
    const shareOnce = jest
      .spyOn(service as any, 'shareDeliveryPinOnce')
      .mockImplementation(() => {
        started.resolve(undefined);
        return result.promise;
      });

    const legitimateRequest = service.shareDeliveryPin(order.id);
    await started.promise;

    let attackerError: unknown;
    try {
      await service.shareDeliveryPin(order.id);
    } catch (error: any) {
      attackerError = error;
    }

    expect(attackerError).toBeInstanceOf(HttpException);
    expect((attackerError as HttpException).getStatus()).toBe(
      HttpStatus.FORBIDDEN
    );
    expect(shareOnce).toHaveBeenCalledTimes(1);

    result.resolve(sharedMessage);
    await expect(legitimateRequest).resolves.toBe(sharedMessage);
  });
});
