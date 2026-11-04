import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/expoNotificationsLoader', () => ({ loadExpoNotifications: vi.fn() }));
vi.mock('./useAppDeepLinkNavigation', () => ({ enqueueAppDeepLink: vi.fn() }));

import { deliveryConfirmUrlFromPush } from './useNotificationOpenedDeliveryConfirm';
import { parseOrderPushPayload } from '../utils/parseOrderPushPayload';

const ID = '0f6e3a5e-1d1b-4b0a-9a51-2c8f6c4d1e2f';

describe('delivery-confirm push', () => {
  const data = {
    type: 'order_status',
    status: 'awaiting_client_confirmation',
    orderId: ID,
    screen: 'delivery-confirm',
    targetPersona: 'client',
    persona: 'client',
  };

  it('maps to the confirm deep link with src=push', () => {
    expect(deliveryConfirmUrlFromPush(data)).toBe(`rendasua://orders/${ID}/confirm?src=push`);
  });

  it('is ignored by the generic order-detail push handler', () => {
    expect(parseOrderPushPayload(data)).toBeNull();
    expect(parseOrderPushPayload({ ...data, screen: undefined })?.orderId).toBe(ID);
  });

  it('rejects other pushes and bad ids', () => {
    expect(deliveryConfirmUrlFromPush({ ...data, screen: undefined })).toBeNull();
    expect(deliveryConfirmUrlFromPush({ ...data, orderId: '../x' })).toBeNull();
  });
});
