const mockSend = jest.fn().mockResolvedValue({ MessageId: 'msg-1' });
const mockSendMessageCommand = jest.fn().mockImplementation((input) => input);

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendMessageCommand: jest
    .fn()
    .mockImplementation((input: unknown) => mockSendMessageCommand(input)),
}));

import { OrderQueueService } from './order-queue.service';

describe('OrderQueueService FIFO grouping', () => {
  const previousQueueUrl = process.env.ORDER_STATUS_QUEUE_URL;

  beforeEach(() => {
    mockSend.mockClear();
    mockSendMessageCommand.mockClear();
    process.env.ORDER_STATUS_QUEUE_URL =
      'https://sqs.ca-central-1.amazonaws.com/123/order-status-changes-test.fifo';
  });

  afterAll(() => {
    if (previousQueueUrl === undefined) {
      delete process.env.ORDER_STATUS_QUEUE_URL;
    } else {
      process.env.ORDER_STATUS_QUEUE_URL = previousQueueUrl;
    }
  });

  function createService() {
    return new OrderQueueService({
      get: jest.fn().mockReturnValue({ region: 'ca-central-1' }),
    } as any);
  }

  it('uses the order id as MessageGroupId so orders process in parallel', async () => {
    const service = createService();
    await service.sendOrderCreatedMessage('order-42');

    expect(mockSendMessageCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        MessageGroupId: 'order-42',
        MessageBody: expect.stringContaining('"orderId":"order-42"'),
      })
    );
  });

  it('falls back to a shared group when orderId is missing', async () => {
    const service = createService();
    await (service as any).sendMessage({
      eventType: 'order.created',
      timestamp: '2026-08-17T10:00:00.000Z',
    });

    expect(mockSendMessageCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        MessageGroupId: 'order-status-events',
      })
    );
  });
});
