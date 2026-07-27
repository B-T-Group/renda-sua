import { HttpException, HttpStatus } from '@nestjs/common';
import { ReturnWorkflowService } from './return-workflow.service';

describe('ReturnWorkflowService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUserService = {
    getUser: jest.fn(),
  };
  const refundEventService = {
    appendEvent: jest.fn(),
  };

  let service: ReturnWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraSystemService.executeMutation.mockResolvedValue({});
    service = new ReturnWorkflowService(
      hasuraSystemService as never,
      hasuraUserService as never,
      refundEventService as never
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockRefundRequestOwners = () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      order_refund_requests_by_pk: {
        business: { user_id: 'business-user' },
        client: { user_id: 'client-user' },
      },
    });
  };

  it('rejects return requests from a business that does not own the refund', async () => {
    hasuraUserService.getUser.mockResolvedValue({ id: 'other-business' });
    mockRefundRequestOwners();

    try {
      await service.requestReturn('refund-1', 'Ship it back');
      fail('Expected requestReturn to reject');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }

    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(refundEventService.appendEvent).not.toHaveBeenCalled();
  });

  it('lets the owning client confirm the return is in transit', async () => {
    hasuraUserService.getUser.mockResolvedValue({ id: 'client-user' });
    mockRefundRequestOwners();

    await service.confirmReturnShipped('refund-1');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpsertReturn'),
      {
        object: {
          refund_request_id: 'refund-1',
          status: 'in_transit',
          instructions: null,
        },
      }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('PatchReq'),
      { id: 'refund-1', set: { return_status: 'in_transit' } }
    );
    expect(refundEventService.appendEvent).toHaveBeenCalledWith({
      refundRequestId: 'refund-1',
      eventType: 'return_in_transit',
      actorType: 'client',
      actorUserId: 'client-user',
    });
  });

  it('records business receipt with inspection notes and timestamp', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-11T10:00:00.000Z'));
    hasuraUserService.getUser.mockResolvedValue({ id: 'business-user' });
    mockRefundRequestOwners();

    await service.markReceived('refund-1', 'Item is intact');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpsertReturn'),
      {
        object: {
          refund_request_id: 'refund-1',
          status: 'received',
          instructions: null,
          received_at: '2026-07-11T10:00:00.000Z',
          inspection_notes: 'Item is intact',
        },
      }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('PatchReq'),
      { id: 'refund-1', set: { return_status: 'received' } }
    );
    expect(refundEventService.appendEvent).toHaveBeenCalledWith({
      refundRequestId: 'refund-1',
      eventType: 'return_received',
      actorType: 'business',
      actorUserId: 'business-user',
    });
  });
});
