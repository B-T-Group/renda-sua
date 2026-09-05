import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AdminCreditsController } from './admin-credits.controller';
import type { OrderFeedbackCreditDto } from './dto/admin-credits.dto';

describe('AdminCreditsController', () => {
  let controller: AdminCreditsController;
  let credits: {
    classifyOrderForOps: jest.Mock;
    awardCancelledFeedback: jest.Mock;
    awardFirstOrderFeedback: jest.Mock;
    awardEscalationResolved: jest.Mock;
    resolveIncidentForCredit: jest.Mock;
  };
  let queues: {
    getOrderForFeedback: jest.Mock;
    isWithinFeedbackWindow: jest.Mock;
    isClientFirstCompletedOrder: jest.Mock;
  };
  let users: { getUser: jest.Mock };

  const cancelledOrder = {
    id: 'order-1',
    current_status: 'cancelled',
    cancelled_at: '2026-08-28T00:00:00.000Z',
    completed_at: null,
    updated_at: '2026-08-28T00:00:00.000Z',
    client_id: 'client-row',
    ops_classification: null as 'test' | 'internal' | null,
    client_user_id: 'client-user',
    business_user_id: 'biz-user',
  };

  beforeEach(() => {
    credits = {
      classifyOrderForOps: jest.fn().mockResolvedValue(true),
      awardCancelledFeedback: jest.fn().mockResolvedValue({ id: 'credit-1' }),
      awardFirstOrderFeedback: jest.fn().mockResolvedValue({ id: 'credit-2' }),
      awardEscalationResolved: jest.fn().mockResolvedValue({ id: 'credit-3' }),
      resolveIncidentForCredit: jest.fn(),
    };
    queues = {
      getOrderForFeedback: jest.fn().mockResolvedValue(cancelledOrder),
      isWithinFeedbackWindow: jest.fn().mockResolvedValue(true),
      isClientFirstCompletedOrder: jest.fn().mockResolvedValue(true),
    };
    users = { getUser: jest.fn().mockResolvedValue({ id: 'ops-1' }) };
    controller = new AdminCreditsController(
      credits as any,
      queues as any,
      users as any
    );
  });

  async function expectStatus(
    run: () => Promise<unknown>,
    status: number
  ): Promise<void> {
    try {
      await run();
      fail('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(status);
    }
  }

  it('blocks the order client or merchant from self-awarding', async () => {
    users.getUser.mockResolvedValue({ id: 'client-user' });
    await expect(
      controller.cancelledFeedback('order-1', {
        action: 'called_client',
        notes: 'own order',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(credits.awardCancelledFeedback).not.toHaveBeenCalled();

    users.getUser.mockResolvedValue({ id: 'biz-user' });
    await expect(
      controller.cancelledFeedback('order-1', {
        action: 'called_business',
        notes: 'own shop',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('classifies test and internal orders without awarding points', async () => {
    await expect(
      controller.cancelledFeedback('order-1', {
        action: 'test_order',
        notes: 'qa checkout',
      })
    ).resolves.toEqual({
      success: true,
      credit: null,
      classification: 'test',
    });
    expect(credits.classifyOrderForOps).toHaveBeenCalledWith({
      orderId: 'order-1',
      classification: 'test',
      actorId: 'ops-1',
      notes: 'qa checkout',
    });
    expect(credits.awardCancelledFeedback).not.toHaveBeenCalled();

    await expect(
      controller.cancelledFeedback('order-1', {
        action: 'internal_order',
        notes: 'staff',
      })
    ).resolves.toEqual({
      success: true,
      credit: null,
      classification: 'internal',
    });
    expect(credits.awardCancelledFeedback).not.toHaveBeenCalled();
  });

  it('conflicts when the order is already classified or classify loses the race', async () => {
    queues.getOrderForFeedback.mockResolvedValue({
      ...cancelledOrder,
      ops_classification: 'test',
    });
    await expectStatus(
      () =>
        controller.cancelledFeedback('order-1', {
          action: 'called_client',
          notes: 'late',
        }),
      HttpStatus.CONFLICT
    );
    expect(credits.classifyOrderForOps).not.toHaveBeenCalled();
    expect(credits.awardCancelledFeedback).not.toHaveBeenCalled();

    queues.getOrderForFeedback.mockResolvedValue(cancelledOrder);
    credits.classifyOrderForOps.mockResolvedValueOnce(false);
    await expectStatus(
      () =>
        controller.cancelledFeedback('order-1', {
          action: 'test_order',
          notes: 'dup',
        }),
      HttpStatus.CONFLICT
    );
  });

  it('rejects the wrong status or a stamp outside the 14-day window', async () => {
    queues.getOrderForFeedback.mockResolvedValue({
      ...cancelledOrder,
      current_status: 'pending',
    });
    await expect(
      controller.cancelledFeedback('order-1', {
        action: 'called_client',
        notes: 'still open',
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    queues.getOrderForFeedback.mockResolvedValue(cancelledOrder);
    queues.isWithinFeedbackWindow.mockResolvedValueOnce(false);
    await expectStatus(
      () =>
        controller.cancelledFeedback('order-1', {
          action: 'called_client',
          notes: 'too old',
        }),
      HttpStatus.BAD_REQUEST
    );
    expect(credits.awardCancelledFeedback).not.toHaveBeenCalled();
  });

  it('maps called_business to the call channel and awards cancelled feedback', async () => {
    await expect(
      controller.cancelledFeedback('order-1', {
        action: 'called_business',
        notes: 'merchant confirmed cancel',
      })
    ).resolves.toEqual({ success: true, credit: { id: 'credit-1' } });
    expect(credits.awardCancelledFeedback).toHaveBeenCalledWith({
      userId: 'ops-1',
      orderId: 'order-1',
      notes: 'merchant confirmed cancel',
      contactChannel: 'call',
    });
  });

  it('maps emailed_client to email and conflicts on a duplicate award', async () => {
    credits.awardCancelledFeedback.mockResolvedValueOnce(null);
    await expectStatus(
      () =>
        controller.cancelledFeedback('order-1', {
          action: 'emailed_client',
          notes: 'already logged',
        }),
      HttpStatus.CONFLICT
    );
    expect(credits.awardCancelledFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ contactChannel: 'email' })
    );
  });

  it('requires a true first completion before awarding first-order points', async () => {
    queues.getOrderForFeedback.mockResolvedValue({
      ...cancelledOrder,
      current_status: 'complete',
      completed_at: '2026-08-28T00:00:00.000Z',
    });
    queues.isClientFirstCompletedOrder.mockResolvedValueOnce(false);

    await expect(
      controller.firstOrderFeedback('order-1', {
        action: 'spoke_in_person',
        notes: 'second order',
      } as OrderFeedbackCreditDto)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(credits.awardFirstOrderFeedback).not.toHaveBeenCalled();
  });

  it('awards first-order feedback on an in-person call-back', async () => {
    queues.getOrderForFeedback.mockResolvedValue({
      ...cancelledOrder,
      current_status: 'complete',
      completed_at: '2026-08-28T00:00:00.000Z',
    });

    await expect(
      controller.firstOrderFeedback('order-1', {
        action: 'spoke_in_person',
        notes: 'happy first order',
      })
    ).resolves.toEqual({ success: true, credit: { id: 'credit-2' } });
    expect(credits.awardFirstOrderFeedback).toHaveBeenCalledWith({
      userId: 'ops-1',
      orderId: 'order-1',
      notes: 'happy first order',
      contactChannel: 'in_person',
    });
  });

  it('resolves an escalation only after the incident is found', async () => {
    credits.resolveIncidentForCredit.mockResolvedValueOnce(null);
    await expect(
      controller.resolveEscalation('inc-missing', {
        contact_channel: 'call',
        order_result: 'confirmed',
        notes: 'gone',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(credits.awardEscalationResolved).not.toHaveBeenCalled();

    credits.resolveIncidentForCredit.mockResolvedValueOnce({
      id: 'inc-1',
      order_id: 'order-1',
      resolved_at: 'now',
    });
    await expect(
      controller.resolveEscalation('inc-1', {
        contact_channel: 'call',
        order_result: 'confirmed',
        notes: 'reached',
      })
    ).resolves.toEqual({
      success: true,
      incident: {
        id: 'inc-1',
        order_id: 'order-1',
        resolved_at: 'now',
      },
      credit: { id: 'credit-3' },
    });
    expect(credits.awardEscalationResolved).toHaveBeenCalledWith({
      userId: 'ops-1',
      incidentId: 'inc-1',
      orderId: 'order-1',
      contactChannel: 'call',
      orderResult: 'confirmed',
      notes: 'reached',
    });
  });
});
