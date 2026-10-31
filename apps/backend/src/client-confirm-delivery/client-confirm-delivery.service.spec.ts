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
  };
  const marketConfig = {
    forOrder: jest.fn().mockResolvedValue({
      countryCode: 'CA',
      isStripeRail: true,
      autoCompleteHours: 2,
      graceMinutes: 5,
      nonStripeSupportHours: 48,
      giftBuyerCanConfirm: true,
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
  const svc = new ClientConfirmDeliveryService(
    users as any,
    repo as any,
    marketConfig as any,
    orderStatus as any,
    orders as any,
    support as any,
    recipientNotifications as any
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
});
