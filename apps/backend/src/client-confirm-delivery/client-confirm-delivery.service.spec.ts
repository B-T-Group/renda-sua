import { HttpException } from '@nestjs/common';
import { ClientConfirmDeliveryService } from './client-confirm-delivery.service';
import {
  AWAITING_CLIENT_CONFIRMATION,
  DISPUTED,
  PENDING_AUTO_COMPLETE,
} from './client-confirm-delivery.constants';

const PHOTO = {
  photoUrl: 'https://cdn.example.com/proof.jpg',
  capturedAt: '2026-10-31T12:10:00Z',
  latitude: 3.86,
  longitude: 11.5,
};

function buildService(overrides: Record<string, any> = {}) {
  const users = {
    getUser: jest.fn().mockResolvedValue({
      id: 'agent-user',
      active_persona: 'agent',
      agent: { id: 'agent-1' },
    }),
  };
  const repo = {
    loadOrder: jest.fn(),
    stampRequestedAt: jest.fn(),
    stampConfirmationMethod: jest.fn().mockResolvedValue(true),
    stampFallback: jest.fn(),
    insertProofPhotos: jest.fn(),
    listProofPhotos: jest.fn().mockResolvedValue([]),
    dueAutoComplete: jest.fn().mockResolvedValue([]),
    awaitingSince: jest.fn().mockResolvedValue([]),
    stampReminder: jest.fn(),
    stampSupportTicket: jest.fn(),
    stampDelivered: jest.fn(),
    stampDeliveredIfMissing: jest.fn(),
    stampReportWindow: jest.fn(),
    awaitingWithoutDeadline: jest.fn().mockResolvedValue([]),
    backfillDeadline: jest.fn().mockResolvedValue(true),
    dueMomoAutoComplete: jest.fn().mockResolvedValue([]),
    pendingMomoReminders: jest.fn().mockResolvedValue([]),
    claimReminder: jest.fn().mockResolvedValue(true),
    openDispute: jest.fn(),
    insertReport: jest.fn().mockResolvedValue('report-1'),
  };
  const marketConfig = {
    forOrder: jest.fn().mockResolvedValue({
      countryCode: 'CA',
      isStripeRail: true,
      autoCompleteHours: 2,
      graceMinutes: 5,
      nonStripeSupportHours: 48,
      giftBuyerCanConfirm: true,
      momoAutoCompleteHours: 2,
      momoReminderHours: 1,
      reportWindowHours: 24,
      clientFlagThreshold: 2,
      clientFlagWindowDays: 90,
    }),
  };
  const orderStatus = { updateOrderStatus: jest.fn().mockResolvedValue({}) };
  const orders = {
    completeAfterClientConfirmation: jest.fn().mockResolvedValue({
      alreadyComplete: false,
      order: { current_status: 'complete' },
    }),
    recordClientConfirmHistory: jest.fn(),
    confirmOrderReceipt: jest.fn().mockResolvedValue({
      success: true,
      order: { current_status: 'complete' },
      message: 'Receipt confirmed; order complete',
    }),
  };
  const support = {
    createTicket: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
  };
  const recipientNotifications = {
    notifyDeliveryConfirm: jest.fn(),
  };
  const notifier = {
    sendReminder: jest.fn().mockResolvedValue(true),
    sendAutoCompleted: jest.fn().mockResolvedValue(true),
  };
  const svc = new ClientConfirmDeliveryService(
    users as any,
    repo as any,
    marketConfig as any,
    orderStatus as any,
    orders as any,
    support as any,
    recipientNotifications as any,
    notifier as any
  );
  Object.assign(svc as any, overrides);
  return {
    svc,
    users,
    repo,
    marketConfig,
    orderStatus,
    orders,
    support,
    recipientNotifications,
    notifier,
  };
}

function deliveryOrder(extra: Record<string, any> = {}) {
  return {
    id: 'order-1',
    order_number: 'ORD-1',
    current_status: 'out_for_delivery',
    fulfillment_method: 'delivery',
    fulfillment_country: 'CA',
    assigned_agent_id: 'agent-1',
    assigned_agent: { id: 'agent-1', user_id: 'agent-user', status: 'active' },
    client: { id: 'c1', user_id: 'client-user' },
    client_id: 'c1',
    delivery_pin_hash: null,
    ...extra,
  };
}

describe('ClientConfirmDeliveryService', () => {
  it('markDelivered moves to awaiting_client_confirmation and notifies gifts', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ is_third_party_recipient: true })
    );

    const result = await ctx.svc.markDelivered('order-1');

    expect(result.status).toBe(AWAITING_CLIENT_CONFIRMATION);
    expect(ctx.orderStatus.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      { viaSystem: true }
    );
    expect(ctx.recipientNotifications.notifyDeliveryConfirm).toHaveBeenCalledWith(
      'order-1'
    );
    expect(ctx.orders.recordClientConfirmHistory).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      expect.any(String),
      'agent-user',
      'agent'
    );
  });

  it('markDelivered returns success when post-commit side-effects throw', async () => {
    const ctx = buildService();
    ctx.orders.recordClientConfirmHistory.mockRejectedValue(new Error('history down'));
    ctx.repo.stampRequestedAt.mockRejectedValue(new Error('stamp down'));
    ctx.recipientNotifications.notifyDeliveryConfirm.mockRejectedValue(
      new Error('notify down')
    );
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ is_third_party_recipient: true })
    );

    const result = await ctx.svc.markDelivered('order-1');

    expect(result).toMatchObject({
      success: true,
      status: AWAITING_CLIENT_CONFIRMATION,
    });
    expect(ctx.orderStatus.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      { viaSystem: true }
    );
  });

  it('rejects markDelivered on mid-flight PIN orders', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ delivery_pin_hash: 'hash' })
    );
    await expect(ctx.svc.markDelivered('order-1')).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('confirmReceipt settles once and is idempotent when already complete', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
    );
    ctx.orders.completeAfterClientConfirmation.mockResolvedValue({
      alreadyComplete: true,
      order: { current_status: 'complete' },
    });

    const first = await ctx.svc.confirmReceipt('order-1');
    expect(first.alreadyComplete).toBe(true);
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledTimes(1);
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
      'order-1',
      expect.any(String),
      'client'
    );
  });

  it('rejects confirmReceipt on mid-flight PIN orders', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        delivery_pin_hash: 'hash',
      })
    );

    await expect(ctx.svc.confirmReceipt('order-1')).rejects.toBeInstanceOf(
      HttpException
    );
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
  });

  it('confirmReceipt is a no-op when the order is already complete', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ current_status: 'complete', delivery_confirmation_method: 'client' })
    );

    const result = await ctx.svc.confirmReceipt('order-1');

    expect(result.alreadyComplete).toBe(true);
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
  });

  it('confirmReceipt delegates shipping orders to the existing receipt path', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ fulfillment_method: 'shipping', current_status: 'shipped' })
    );

    const result = await ctx.svc.confirmReceipt('order-1');

    expect(ctx.orders.confirmOrderReceipt).toHaveBeenCalledWith('order-1');
    expect(result.status).toBe('complete');
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
  });

  it('reportProblem sets disputed, holds payouts, and opens a support case', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
    );

    const result = await ctx.svc.reportProblem('order-1', 'Wrong items');

    expect(result.status).toBe(DISPUTED);
    expect(ctx.orderStatus.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      DISPUTED,
      { viaSystem: true }
    );
    expect(ctx.support.createTicket).toHaveBeenCalledWith(
      'client-user',
      expect.objectContaining({ type: 'dispute', orderId: 'order-1' })
    );
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    expect(ctx.orders.recordClientConfirmHistory).toHaveBeenCalledWith(
      'order-1',
      DISPUTED,
      'Client reported an issue (other): Wrong items',
      'client-user',
      'client'
    );
  });

  it('rejects Stripe fallback on a non-Stripe market', async () => {
    const ctx = buildService();
    ctx.marketConfig.forOrder.mockResolvedValue({
      isStripeRail: false,
      graceMinutes: 5,
      autoCompleteHours: 2,
      giftBuyerCanConfirm: true,
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        fulfillment_country: 'CM',
        client_confirmation_requested_at: '2026-10-31T10:00:00Z',
      })
    );

    await expect(
      ctx.svc.submitCouldNotConfirm('order-1', [PHOTO])
    ).rejects.toMatchObject({ status: 403 });
  });

  it('accepts Stripe fallback after grace with a geotagged photo', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        client_confirmation_requested_at: '2026-10-31T10:00:00Z',
        is_third_party_recipient: true,
      })
    );

    const result = await ctx.svc.submitCouldNotConfirm('order-1', [PHOTO]);

    expect(result.status).toBe(PENDING_AUTO_COMPLETE);
    expect(ctx.repo.insertProofPhotos).toHaveBeenCalled();
    expect(ctx.recipientNotifications.notifyDeliveryConfirm).toHaveBeenCalledWith(
      'order-1'
    );
    expect(ctx.orderStatus.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      PENDING_AUTO_COMPLETE,
      { viaSystem: true }
    );
    expect(ctx.orders.recordClientConfirmHistory).toHaveBeenCalledWith(
      'order-1',
      PENDING_AUTO_COMPLETE,
      expect.any(String),
      'agent-user',
      'agent'
    );
  });

  it('rejects fallback without GPS/timestamp photo metadata', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        client_confirmation_requested_at: '2026-10-31T10:00:00Z',
      })
    );
    await expect(
      ctx.svc.submitCouldNotConfirm('order-1', [
        { photoUrl: 'https://x', capturedAt: '', latitude: 0, longitude: 0 },
      ] as any)
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('autoCompleteDue completes pending orders and skips others', async () => {
    const ctx = buildService();
    ctx.repo.dueAutoComplete.mockResolvedValue(['due-1', 'skip-1']);
    ctx.repo.loadOrder
      .mockResolvedValueOnce(
        deliveryOrder({ id: 'due-1', current_status: PENDING_AUTO_COMPLETE })
      )
      .mockResolvedValueOnce(
        deliveryOrder({ id: 'skip-1', current_status: 'complete' })
      );

    const result = await ctx.svc.autoCompleteDue();

    expect(result.completed).toBe(1);
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledTimes(1);
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
      'due-1',
      expect.any(String)
    );
  });

  it('enterAwaitingAfterPayment does not complete new-flow orders', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ current_status: 'out_for_delivery' })
    );

    await ctx.svc.enterAwaitingAfterPayment('order-1', 'PAD paid');

    expect(ctx.orderStatus.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      { viaSystem: true }
    );
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    expect(ctx.orders.recordClientConfirmHistory).toHaveBeenCalledWith(
      'order-1',
      AWAITING_CLIENT_CONFIRMATION,
      'PAD paid',
      undefined,
      'system'
    );
  });

  it('enterAwaitingAfterPayment keeps mid-flight PIN on the old complete path', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ delivery_pin_hash: 'hash' })
    );

    await ctx.svc.enterAwaitingAfterPayment('order-1', 'PAD paid');

    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalled();
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('OQ1: gift buyer confirm is rejected when the flag is off', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.marketConfig.forOrder.mockResolvedValue({
      isStripeRail: true,
      graceMinutes: 5,
      autoCompleteHours: 2,
      giftBuyerCanConfirm: false,
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        is_third_party_recipient: true,
      })
    );

    await expect(ctx.svc.confirmReceipt('order-1')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('uses the stamp write result when another confirmer already labeled the order', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.repo.stampConfirmationMethod.mockResolvedValue(false);
    ctx.repo.loadOrder
      .mockResolvedValueOnce(
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
      )
      .mockResolvedValueOnce(
        deliveryOrder({
          current_status: 'complete',
          delivery_confirmation_method: 'auto_complete',
        })
      );

    const result = await ctx.svc.confirmReceipt('order-1');

    expect(result.confirmationMethod).toBe('auto_complete');
  });

  it('gift Problem on an awaiting order disputes as client', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        recipient_phone: '+237670000000',
      })
    );

    const result = await ctx.svc.handleRecipientAction(
      'order-1',
      '+237670000000',
      'problem'
    );

    expect(result).toMatchObject({ success: true, status: DISPUTED });
    expect(ctx.orders.recordClientConfirmHistory).toHaveBeenCalledWith(
      'order-1',
      DISPUTED,
      'Gift recipient reported a delivery problem',
      'client-user',
      'client'
    );
  });

  it('late gift Problem on a completed order opens a post-completion claim', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: 'complete',
        recipient_phone: '+237670000000',
      })
    );

    const result = await ctx.svc.handleRecipientAction(
      'order-1',
      '+237670000000',
      'problem'
    );

    expect(result).toMatchObject({
      success: true,
      status: 'complete',
      postCompletionClaim: true,
    });
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(ctx.support.createTicket).toHaveBeenCalledWith(
      'client-user',
      expect.objectContaining({ type: 'complaint', orderId: 'order-1' })
    );
  });

  it('gift Problem on a mid-flight PIN order refuses without disputing', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        delivery_pin_hash: 'hash',
        recipient_phone: '+237670000000',
      })
    );

    const result = await ctx.svc.handleRecipientAction(
      'order-1',
      '+237670000000',
      'problem'
    );

    expect(result).toMatchObject({
      success: false,
      status: 'out_for_delivery',
    });
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(ctx.support.createTicket).not.toHaveBeenCalled();
  });

  it('refuses markDelivered from the wrong agent, a suspended agent, or the wrong status', async () => {
    const wrongAgent = buildService();
    wrongAgent.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ assigned_agent_id: 'agent-2' })
    );
    await expect(wrongAgent.svc.markDelivered('order-1')).rejects.toMatchObject({
      status: 403,
    });

    const suspended = buildService();
    suspended.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ assigned_agent: { id: 'agent-1', status: 'suspended' } })
    );
    await expect(suspended.svc.markDelivered('order-1')).rejects.toMatchObject({
      status: 403,
    });

    const tooEarly = buildService();
    tooEarly.repo.loadOrder.mockResolvedValue(
      deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
    );
    await expect(tooEarly.svc.markDelivered('order-1')).rejects.toMatchObject({
      status: 400,
    });

    expect(wrongAgent.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(suspended.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(tooEarly.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('labels a gift-buyer confirm as buyer and still records changed_by_type client', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        is_third_party_recipient: true,
      })
    );

    const result = await ctx.svc.confirmReceipt('order-1');

    expect(result.confirmationMethod).toBe('buyer');
    expect(ctx.repo.stampConfirmationMethod).toHaveBeenCalledWith(
      'order-1',
      'buyer',
      expect.any(String)
    );
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
      'order-1',
      'Completed by gift buyer on recipient behalf (OQ1)',
      'client'
    );
  });

  it('lets a normalized recipient phone confirm without a client session', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        recipient_phone: '00237670000000',
      })
    );

    const result = await ctx.svc.handleRecipientAction(
      'order-1',
      '+237 670-000-000',
      'received'
    );

    expect(result).toMatchObject({ success: true, status: 'complete' });
    expect(ctx.users.getUser).not.toHaveBeenCalled();
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
      'order-1',
      'Completed by gift recipient confirmation',
      'client'
    );
  });

  it('rejects a recipient reply from a different phone without mutating the order', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        recipient_phone: '+237670000000',
      })
    );

    await expect(
      ctx.svc.handleRecipientAction('order-1', '+19995550100', 'received')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      ctx.svc.handleRecipientAction('order-1', '', 'problem')
    ).rejects.toMatchObject({ status: 403 });
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(ctx.support.createTicket).not.toHaveBeenCalled();
  });

  it('does not dispute a gift Problem before the order is out for delivery', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: 'picked_up',
        recipient_phone: '+237670000000',
      })
    );

    const result = await ctx.svc.handleRecipientAction(
      'order-1',
      '+237670000000',
      'problem'
    );

    expect(result).toMatchObject({ success: false, status: 'picked_up' });
    expect(ctx.support.createTicket).not.toHaveBeenCalled();
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('does not open a second ticket when the delivery is already disputed', async () => {
    const ctx = buildService();
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'c1' },
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: DISPUTED,
        awaiting_confirm_support_ticket_id: 'ticket-existing',
      })
    );

    const result = await ctx.svc.reportProblem('order-1', 'again');

    expect(result).toMatchObject({
      success: true,
      status: DISPUTED,
      ticketId: 'ticket-existing',
    });
    expect(ctx.support.createTicket).not.toHaveBeenCalled();
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('does not store photo proof before grace or without a real photo url', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        client_confirmation_requested_at: new Date().toISOString(),
      })
    );

    await expect(
      ctx.svc.submitCouldNotConfirm('order-1', [PHOTO])
    ).rejects.toMatchObject({ status: 400 });

    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        client_confirmation_requested_at: new Date(
          Date.now() - 10 * 60_000
        ).toISOString(),
      })
    );
    await expect(
      ctx.svc.submitCouldNotConfirm('order-1', [])
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      ctx.svc.submitCouldNotConfirm('order-1', [{ ...PHOTO, photoUrl: '   ' }])
    ).rejects.toMatchObject({ status: 400 });

    expect(ctx.repo.insertProofPhotos).not.toHaveBeenCalled();
    expect(ctx.repo.stampFallback).not.toHaveBeenCalled();
    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('offers photo fallback only after grace on a Stripe doorstep order', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        client_confirmation_requested_at: new Date(
          Date.now() - 60_000
        ).toISOString(),
      })
    );

    const early = await ctx.svc.getState('order-1');
    expect(early.canSubmitFallback).toBe(false);
    expect(early.agentMessageKey).toBe('agent.waiting');

    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        client_confirmation_requested_at: new Date(
          Date.now() - 6 * 60_000
        ).toISOString(),
      })
    );
    const open = await ctx.svc.getState('order-1');
    expect(open.canSubmitFallback).toBe(true);
    expect(open.agentMessageKey).toBe('agent.fallback.cta');

    ctx.marketConfig.forOrder.mockResolvedValue({
      isStripeRail: false,
      graceMinutes: 5,
      autoCompleteHours: 2,
      giftBuyerCanConfirm: true,
    });
    const momo = await ctx.svc.getState('order-1');
    expect(momo.canSubmitFallback).toBe(false);
    expect(momo.agentMessageKey).toBe('agent.nonstripe');

    ctx.marketConfig.forOrder.mockResolvedValue({
      isStripeRail: true,
      graceMinutes: 5,
      autoCompleteHours: 2,
      giftBuyerCanConfirm: true,
    });
    ctx.repo.loadOrder.mockResolvedValue(
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        delivery_pin_hash: 'hash',
        client_confirmation_requested_at: new Date(
          Date.now() - 6 * 60_000
        ).toISOString(),
      })
    );
    const legacy = await ctx.svc.getState('order-1');
    expect(legacy.usesLegacyPin).toBe(true);
    expect(legacy.isClientConfirmFlow).toBe(false);
    expect(legacy.canSubmitFallback).toBe(false);
  });

  it('still completes when the auto-complete label was already stamped', async () => {
    const ctx = buildService();
    ctx.repo.dueAutoComplete.mockResolvedValue(['missing', 'stamped']);
    ctx.repo.loadOrder
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        deliveryOrder({ id: 'stamped', current_status: PENDING_AUTO_COMPLETE })
      );
    ctx.repo.stampConfirmationMethod.mockResolvedValue(false);

    const result = await ctx.svc.autoCompleteDue();

    expect(result.completed).toBe(1);
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledTimes(1);
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
      'stamped',
      'Completed after photo fallback (confirmation method already recorded)'
    );
  });

  it('does not transition again when payment arrives on an awaiting or complete order', async () => {
    const ctx = buildService();
    ctx.repo.loadOrder
      .mockResolvedValueOnce(
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
      )
      .mockResolvedValueOnce(deliveryOrder({ current_status: 'complete' }));

    await ctx.svc.enterAwaitingAfterPayment('order-1', 'again');
    await ctx.svc.enterAwaitingAfterPayment('order-1', 'done');

    expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    expect(ctx.repo.stampRequestedAt).not.toHaveBeenCalled();
  });

  it('reminds non-Stripe orders on the 1h and 24h marks and escalates once at the SLA', async () => {
    const ctx = buildService();
    const now = new Date('2026-10-31T12:00:00.000Z');
    ctx.marketConfig.forOrder.mockImplementation(async (order: { fulfillment_country?: string }) => ({
      countryCode: order.fulfillment_country,
      isStripeRail: order.fulfillment_country === 'CA',
      autoCompleteHours: 2,
      graceMinutes: 5,
      nonStripeSupportHours: order.fulfillment_country === 'GA' ? 12 : 48,
      giftBuyerCanConfirm: true,
    }));
    ctx.repo.awaitingSince.mockResolvedValue([
      deliveryOrder({
        id: 'stripe',
        fulfillment_country: 'CA',
        client_confirmation_requested_at: '2026-10-29T12:00:00.000Z',
      }),
      deliveryOrder({
        id: 'bad-time',
        fulfillment_country: 'CM',
        client_confirmation_requested_at: 'not-a-time',
      }),
      deliveryOrder({
        id: 'under-hour',
        fulfillment_country: 'CM',
        client_confirmation_requested_at: '2026-10-31T11:01:00.000Z',
      }),
      deliveryOrder({
        id: 'hour',
        fulfillment_country: 'CM',
        client_confirmation_requested_at: '2026-10-31T11:00:00.000Z',
      }),
      deliveryOrder({
        id: 'day',
        fulfillment_country: 'CM',
        client_confirmation_requested_at: '2026-10-30T12:00:00.000Z',
        awaiting_confirm_reminder_1h_at: '2026-10-30T13:00:00.000Z',
      }),
      deliveryOrder({
        id: 'sla',
        fulfillment_country: 'CM',
        client_confirmation_requested_at: '2026-10-29T12:00:00.000Z',
      }),
      deliveryOrder({
        id: 'already',
        fulfillment_country: 'CM',
        client_confirmation_requested_at: '2026-10-29T12:00:00.000Z',
        awaiting_confirm_support_ticket_id: 'ticket-existing',
        awaiting_confirm_reminder_1h_at: '2026-10-29T13:00:00.000Z',
        awaiting_confirm_reminder_24h_at: '2026-10-30T12:00:00.000Z',
      }),
      deliveryOrder({
        id: 'short-sla',
        fulfillment_country: 'GA',
        client_confirmation_requested_at: '2026-10-31T00:00:00.000Z',
      }),
    ]);

    const result = await ctx.svc.processNonStripeStuck(now);

    expect(ctx.repo.awaitingSince).toHaveBeenCalledWith(
      '2026-10-31T11:00:00.000Z',
      50
    );
    expect(result).toEqual({ reminded1h: 1, reminded24h: 1, tickets: 2 });
    expect(ctx.repo.stampReminder).toHaveBeenCalledTimes(2);
    expect(ctx.repo.stampReminder).toHaveBeenCalledWith(
      'hour',
      'awaiting_confirm_reminder_1h_at',
      now.toISOString()
    );
    expect(ctx.repo.stampReminder).toHaveBeenCalledWith(
      'day',
      'awaiting_confirm_reminder_24h_at',
      now.toISOString()
    );
    expect(ctx.support.createTicket).toHaveBeenCalledTimes(2);
    expect(ctx.repo.stampSupportTicket).toHaveBeenCalledWith(
      'sla',
      'ticket-1',
      now.toISOString()
    );
    expect(ctx.repo.stampSupportTicket).toHaveBeenCalledWith(
      'short-sla',
      'ticket-1',
      now.toISOString()
    );
    expect(ctx.repo.stampReminder).not.toHaveBeenCalledWith(
      'short-sla',
      expect.any(String),
      expect.any(String)
    );
    expect(ctx.support.createTicket).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orderId: 'already' })
    );
  });
});

describe('MoMo Delivered → client Complete', () => {
  const NOW = new Date('2026-11-04T15:00:00Z');
  const MOMO = {
    countryCode: 'CM',
    isStripeRail: false,
    autoCompleteHours: 2,
    graceMinutes: 5,
    nonStripeSupportHours: 48,
    giftBuyerCanConfirm: true,
    momoAutoCompleteHours: 2,
    momoReminderHours: 1,
    reportWindowHours: 24,
    clientFlagThreshold: 2,
    clientFlagWindowDays: 90,
  };
  const asClient = (ctx: ReturnType<typeof buildService>) =>
    ctx.users.getUser.mockResolvedValue({
      id: 'client-user',
      active_persona: 'client',
      user_type_id: 'client',
      client: { id: 'c1' },
    });
  const momoCtx = () => {
    const ctx = buildService();
    ctx.marketConfig.forOrder.mockResolvedValue(MOMO);
    return ctx;
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
  });
  afterEach(() => jest.useRealTimers());

  describe('markDelivered', () => {
    it('stamps delivered_at and freezes a 2h deadline; the agent is not paid', async () => {
      const ctx = momoCtx();
      ctx.repo.loadOrder.mockResolvedValue(deliveryOrder({ fulfillment_country: 'CM' }));
      const result = await ctx.svc.markDelivered('order-1');
      expect(ctx.repo.stampDelivered).toHaveBeenCalledWith(
        'order-1',
        NOW.toISOString(),
        '2026-11-04T17:00:00.000Z'
      );
      expect(result.autoCompleteDeadlineAt).toBe('2026-11-04T17:00:00.000Z');
      expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    });

    it('leaves the Stripe rail without a deadline (unchanged)', async () => {
      const ctx = buildService();
      ctx.repo.loadOrder.mockResolvedValue(deliveryOrder());
      await ctx.svc.markDelivered('order-1');
      expect(ctx.repo.stampDelivered).toHaveBeenCalledWith('order-1', NOW.toISOString(), null);
    });
  });

  describe('client Complete', () => {
    it('from out_for_delivery records delivered and completed with the same timestamp', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(deliveryOrder({ current_status: 'out_for_delivery' }));
      await ctx.svc.confirmReceipt('order-1');
      expect(ctx.repo.stampConfirmationMethod).toHaveBeenCalledWith(
        'order-1',
        'client',
        NOW.toISOString()
      );
      expect(ctx.repo.stampDeliveredIfMissing).toHaveBeenCalledWith('order-1', NOW.toISOString());
      expect(ctx.orders.recordClientConfirmHistory).toHaveBeenCalledWith(
        'order-1',
        AWAITING_CLIENT_CONFIRMATION,
        expect.stringContaining(NOW.toISOString()),
        'client-user',
        'client'
      );
      expect(ctx.repo.stampReportWindow).toHaveBeenCalledWith(
        'order-1',
        '2026-11-05T15:00:00.000Z'
      );
    });

    it('from awaiting does not write a second delivered event', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
      );
      await ctx.svc.confirmReceipt('order-1');
      expect(ctx.repo.stampDeliveredIfMissing).not.toHaveBeenCalled();
      expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledTimes(1);
    });

    it('is refused once the order is disputed (hold stays locked)', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(deliveryOrder({ current_status: DISPUTED }));
      await expect(ctx.svc.confirmReceipt('order-1')).rejects.toBeInstanceOf(HttpException);
      expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('auto-complete', () => {
    const due = (extra: Record<string, any> = {}) =>
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        fulfillment_country: 'CM',
        auto_complete_deadline_at: '2026-11-04T14:59:00Z',
        ...extra,
      });

    it('completes a due MoMo order once, then tells the client about the 24h window', async () => {
      const ctx = momoCtx();
      ctx.repo.dueMomoAutoComplete.mockResolvedValue(['order-1']);
      ctx.repo.loadOrder.mockResolvedValue(due());
      const result = await ctx.svc.autoCompleteDue(NOW);
      expect(result.completed).toBe(1);
      expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
        'order-1',
        expect.stringContaining('Auto-completed 2 h after delivery')
      );
      // Method is stamped only after the status CAS was won.
      const completeOrder = ctx.orders.completeAfterClientConfirmation.mock.invocationCallOrder[0];
      const stampOrder = ctx.repo.stampConfirmationMethod.mock.invocationCallOrder[0];
      expect(stampOrder).toBeGreaterThan(completeOrder);
      expect(ctx.notifier.sendAutoCompleted).toHaveBeenCalledWith('order-1', 24);
      expect(ctx.repo.stampReportWindow).toHaveBeenCalled();
    });

    it('never completes an order with a report on it', async () => {
      const ctx = momoCtx();
      ctx.repo.dueMomoAutoComplete.mockResolvedValue(['order-1']);
      ctx.repo.loadOrder.mockResolvedValue(due({ dispute_opened_at: '2026-11-04T14:00:00Z' }));
      expect((await ctx.svc.autoCompleteDue(NOW)).completed).toBe(0);
      ctx.repo.loadOrder.mockResolvedValue(due({ current_status: DISPUTED }));
      expect((await ctx.svc.autoCompleteDue(NOW)).completed).toBe(0);
      expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    });

    it('skips orders that are not due yet or on the Stripe rail', async () => {
      const ctx = momoCtx();
      ctx.repo.dueMomoAutoComplete.mockResolvedValue(['order-1']);
      ctx.repo.loadOrder.mockResolvedValue(due({ auto_complete_deadline_at: '2026-11-04T15:30:00Z' }));
      expect((await ctx.svc.autoCompleteDue(NOW)).completed).toBe(0);
      ctx.marketConfig.forOrder.mockResolvedValue({ ...MOMO, isStripeRail: true });
      ctx.repo.loadOrder.mockResolvedValue(due());
      expect((await ctx.svc.autoCompleteDue(NOW)).completed).toBe(0);
      expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    });

    it('loses the race to client Complete quietly: no second message, no stamp', async () => {
      const ctx = momoCtx();
      ctx.repo.dueMomoAutoComplete.mockResolvedValue(['order-1']);
      ctx.repo.loadOrder.mockResolvedValue(due());
      ctx.orders.completeAfterClientConfirmation.mockResolvedValue({
        alreadyComplete: true,
        order: null,
      });
      expect((await ctx.svc.autoCompleteDue(NOW)).completed).toBe(0);
      expect(ctx.repo.stampConfirmationMethod).not.toHaveBeenCalled();
      expect(ctx.notifier.sendAutoCompleted).not.toHaveBeenCalled();
    });

    it('loses the race to a report: the refused transition is swallowed and nothing settles', async () => {
      const ctx = momoCtx();
      ctx.repo.dueMomoAutoComplete.mockResolvedValue(['order-1']);
      ctx.repo.loadOrder.mockResolvedValue(due());
      ctx.orders.completeAfterClientConfirmation.mockRejectedValue(
        new Error('Invalid status transition from disputed to complete')
      );
      expect((await ctx.svc.autoCompleteDue(NOW)).completed).toBe(0);
      expect(ctx.repo.stampConfirmationMethod).not.toHaveBeenCalled();
      expect(ctx.notifier.sendAutoCompleted).not.toHaveBeenCalled();
    });
  });

  describe('1h reminder', () => {
    const awaiting = (deadline: string) =>
      deliveryOrder({
        current_status: AWAITING_CLIENT_CONFIRMATION,
        fulfillment_country: 'CM',
        auto_complete_deadline_at: deadline,
      });

    it('claims, then sends once the reminder time has passed', async () => {
      const ctx = momoCtx();
      ctx.repo.pendingMomoReminders.mockResolvedValue([awaiting('2026-11-04T15:50:00Z')]);
      expect((await ctx.svc.sendDueReminders(NOW)).reminded).toBe(1);
      expect(ctx.repo.claimReminder).toHaveBeenCalledWith('order-1', NOW.toISOString());
      expect(ctx.notifier.sendReminder).toHaveBeenCalledWith('order-1', 50);
    });

    it('does not send when another worker already claimed it', async () => {
      const ctx = momoCtx();
      ctx.repo.pendingMomoReminders.mockResolvedValue([awaiting('2026-11-04T15:50:00Z')]);
      ctx.repo.claimReminder.mockResolvedValue(false);
      expect((await ctx.svc.sendDueReminders(NOW)).reminded).toBe(0);
      expect(ctx.notifier.sendReminder).not.toHaveBeenCalled();
    });

    it('waits until delivered + 1h', async () => {
      const ctx = momoCtx();
      ctx.repo.pendingMomoReminders.mockResolvedValue([awaiting('2026-11-04T16:30:00Z')]);
      expect((await ctx.svc.sendDueReminders(NOW)).reminded).toBe(0);
      expect(ctx.repo.claimReminder).not.toHaveBeenCalled();
    });
  });

  describe('in-flight orders', () => {
    it('gives awaiting MoMo orders a fresh deadline from now, never retroactive', async () => {
      const ctx = momoCtx();
      ctx.repo.awaitingWithoutDeadline.mockResolvedValue([
        deliveryOrder({
          current_status: AWAITING_CLIENT_CONFIRMATION,
          client_confirmation_requested_at: '2026-11-01T10:00:00Z',
        }),
      ]);
      expect((await ctx.svc.backfillInFlightDeadlines(NOW)).backfilled).toBe(1);
      expect(ctx.repo.backfillDeadline).toHaveBeenCalledWith(
        'order-1',
        '2026-11-01T10:00:00Z',
        '2026-11-04T17:00:00.000Z',
        NOW.toISOString()
      );
    });

    it('leaves Stripe and legacy PIN orders alone', async () => {
      const ctx = buildService();
      ctx.repo.awaitingWithoutDeadline.mockResolvedValue([
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION }),
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION, delivery_pin_hash: 'x' }),
      ]);
      expect((await ctx.svc.backfillInFlightDeadlines(NOW)).backfilled).toBe(0);
      expect(ctx.repo.backfillDeadline).not.toHaveBeenCalled();
    });

    it('legacy stuck sweep ignores orders that now have a deadline', async () => {
      const ctx = momoCtx();
      ctx.repo.awaitingSince.mockResolvedValue([
        deliveryOrder({
          current_status: AWAITING_CLIENT_CONFIRMATION,
          client_confirmation_requested_at: '2026-11-04T10:00:00Z',
          auto_complete_deadline_at: '2026-11-04T17:00:00Z',
        }),
      ]);
      const counts = await ctx.svc.processNonStripeStuck(NOW);
      expect(counts).toEqual({ reminded1h: 0, reminded24h: 0, tickets: 0 });
      expect(ctx.repo.stampReminder).not.toHaveBeenCalled();
    });
  });

  describe('reports', () => {
    it('Delivery failed / Courier didn\'t come pauses auto-complete and goes to support', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
      );
      const result = await ctx.svc.reportProblem('order-1', {
        type: 'delivery_failed',
        reason: 'courier_didnt_come',
      });
      expect(result.status).toBe(DISPUTED);
      expect(ctx.repo.openDispute).toHaveBeenCalledWith(
        'order-1',
        'delivery_failed',
        'courier_didnt_come',
        NOW.toISOString()
      );
      expect(ctx.repo.insertReport).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'pre_completion', ticketId: 'ticket-1' })
      );
      expect(ctx.repo.stampSupportTicket).toHaveBeenCalledWith(
        'order-1',
        'ticket-1',
        NOW.toISOString()
      );
      expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    });

    it('can be filed from out_for_delivery too', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(deliveryOrder({ current_status: 'out_for_delivery' }));
      const result = await ctx.svc.reportProblem('order-1', { type: 'issue', reason: 'damaged' });
      expect(result.status).toBe(DISPUTED);
    });

    it('rejects an unknown reason', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION })
      );
      await expect(
        ctx.svc.reportProblem('order-1', { type: 'issue', reason: 'courier_didnt_come' })
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('a report that loses the race to completion becomes a post-completion report', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder
        .mockResolvedValueOnce(deliveryOrder({ current_status: AWAITING_CLIENT_CONFIRMATION }))
        .mockResolvedValue(
          deliveryOrder({
            current_status: 'complete',
            report_window_ends_at: '2026-11-05T15:00:00Z',
          })
        );
      ctx.orderStatus.updateOrderStatus.mockRejectedValue(new Error('invalid transition'));
      const result = await ctx.svc.reportProblem('order-1', { type: 'issue', reason: 'wrong_items' });
      expect(result.postCompletionClaim).toBe(true);
      expect(ctx.repo.openDispute).not.toHaveBeenCalled();
      expect(ctx.repo.insertReport).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'post_completion' })
      );
    });

    it('after completion: accepted inside the 24h window, refused after', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({ current_status: 'complete', report_window_ends_at: '2026-11-05T14:00:00Z' })
      );
      const ok = await ctx.svc.reportProblem('order-1', { type: 'issue', reason: 'missing_items' });
      expect(ok.postCompletionClaim).toBe(true);
      expect(ctx.orderStatus.updateOrderStatus).not.toHaveBeenCalled();
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({ current_status: 'complete', report_window_ends_at: '2026-11-04T14:00:00Z' })
      );
      await expect(
        ctx.svc.reportProblem('order-1', { type: 'issue', reason: 'missing_items' })
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('a second report on a disputed order is idempotent', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({ current_status: DISPUTED, awaiting_confirm_support_ticket_id: 't9' })
      );
      const result = await ctx.svc.reportProblem('order-1', { type: 'issue', reason: 'other' });
      expect(result).toEqual(expect.objectContaining({ status: DISPUTED, ticketId: 't9' }));
      expect(ctx.support.createTicket).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('returns no order data to another account (P4)', async () => {
      const ctx = momoCtx();
      ctx.users.getUser.mockResolvedValue({ id: 'stranger' });
      ctx.repo.loadOrder.mockResolvedValue(deliveryOrder());
      expect(await ctx.svc.getState('order-1')).toEqual({
        orderId: 'order-1',
        accessible: false,
        reason: 'other_account',
      });
    });

    it('gives the client the confirm fields and server time', async () => {
      const ctx = momoCtx();
      asClient(ctx);
      ctx.repo.loadOrder.mockResolvedValue(
        deliveryOrder({
          current_status: AWAITING_CLIENT_CONFIRMATION,
          delivered_at: '2026-11-04T14:30:00Z',
          auto_complete_deadline_at: '2026-11-04T16:30:00Z',
        })
      );
      const state: any = await ctx.svc.getState('order-1');
      expect(state).toEqual(
        expect.objectContaining({
          accessible: true,
          viewerRole: 'client',
          serverNow: NOW.toISOString(),
          deliveredAt: '2026-11-04T14:30:00Z',
          reminderAt: '2026-11-04T15:30:00.000Z',
          autoCompleteHours: 2,
          canComplete: true,
          canReport: true,
          confirmVariant: 'awaiting',
        })
      );
    });
  });
});
