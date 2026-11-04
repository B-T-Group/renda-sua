const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendMessageCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

import { Logger } from '@nestjs/common';
import { OrderQueueService } from './order-queue.service';

describe('OrderQueueService send failures', () => {
  const previousQueueUrl = process.env.ORDER_STATUS_QUEUE_URL;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSend.mockReset().mockRejectedValue(new Error('AccessDenied'));
    process.env.ORDER_STATUS_QUEUE_URL =
      'https://sqs.ca-central-1.amazonaws.com/123/order-status-changes-test.fifo';
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    if (previousQueueUrl === undefined)
      delete process.env.ORDER_STATUS_QUEUE_URL;
    else process.env.ORDER_STATUS_QUEUE_URL = previousQueueUrl;
  });

  const createService = () =>
    new OrderQueueService({
      get: jest.fn().mockReturnValue({ region: 'ca-central-1' }),
    } as any);

  it('logs at error level with order id and transition context, without throwing', async () => {
    await expect(
      createService().sendOrderStatusUpdatedMessage(
        'order-7',
        'preparing',
        'ready_for_pickup',
        'user-1'
      )
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = errorSpy.mock.calls[0][0] as string;
    expect(msg).toContain('order.status.updated');
    expect(msg).toContain('order order-7');
    expect(msg).toContain('previousStatus=preparing');
    expect(msg).toContain('status=ready_for_pickup');
    expect(msg).toContain('AccessDenied');
  });

  it('rethrows in strict mode after logging (admin cancel failedSteps)', async () => {
    await expect(
      createService().sendOrderCancelledMessage(
        'order-8',
        'system',
        'r',
        'confirmed',
        'order.cancelled:order-8',
        { strict: true }
      )
    ).rejects.toThrow('AccessDenied');
    const msg = errorSpy.mock.calls[0][0] as string;
    expect(msg).toContain('order order-8');
    expect(msg).toContain('dedupId=order.cancelled:order-8');
    expect(msg).toContain('strict=true');
  });
});
