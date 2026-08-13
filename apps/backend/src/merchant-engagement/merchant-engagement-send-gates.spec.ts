jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { MerchantEngagementService } from './merchant-engagement.service';
import type { MerchantEngagementCandidate } from './merchant-engagement.types';

function candidate(
  overrides: Partial<MerchantEngagementCandidate> = {}
): MerchantEngagementCandidate {
  return {
    businessId: 'b1',
    userId: 'u1',
    email: 'a@b.com',
    preferredLanguage: 'en',
    businessName: 'Shop',
    mainInterest: 'sell_items',
    aiTokens: 5,
    tipsRemindersEnabled: true,
    canAcceptOrders: true,
    lifecycleStatus: 'active',
    hasExpoPush: true,
    approvedItemCount: 2,
    approvedRentalCount: 0,
    pendingItemCount: 0,
    rejectedItemCount: 0,
    hasLogo: true,
    hasOperatingHours: true,
    lastCatalogItemAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    itemsNeedingAiCleanupCount: 0,
    topViewedOutOfStockCount: 0,
    totalProductViews: 0,
    ordersTotal: 0,
    liveSince: new Date(Date.now() - 20 * 86400000).toISOString(),
    ...overrides,
  };
}

describe('MerchantEngagementService send gates', () => {
  const hasuraSystem = {
    executeQuery: jest.fn(),
  };
  const notifications = {
    sendInternalPushByUserId: jest.fn(),
    sendMerchantEngagementHtmlEmail: jest.fn(),
  };
  let service: MerchantEngagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MerchantEngagementService(
      hasuraSystem as never,
      {} as never,
      notifications as never,
      { get: jest.fn() } as never
    );
  });

  it('skips a daily push when any push was already sent today', async () => {
    hasuraSystem.executeQuery.mockResolvedValue({
      merchant_engagement_sends_aggregate: { aggregate: { count: 1 } },
    });

    const sent = await (service as any).trySendPushForCandidate(
      candidate(),
      new Date('2026-08-13T12:00:00Z')
    );

    expect(sent).toBe(false);
    expect(notifications.sendInternalPushByUserId).not.toHaveBeenCalled();
  });

  it('sends a catalog-stalled push once and logs it', async () => {
    hasuraSystem.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('EngagementSentToday')) {
        return {
          merchant_engagement_sends_aggregate: { aggregate: { count: 0 } },
        };
      }
      if (query.includes('EngagementSends')) {
        return { recent: [], once: [] };
      }
      return {};
    });
    notifications.sendInternalPushByUserId.mockResolvedValue({
      expoSent: 1,
      webSent: 0,
    });

    const sent = await (service as any).trySendPushForCandidate(
      candidate(),
      new Date('2026-08-13T12:00:00Z')
    );

    expect(sent).toBe(true);
    expect(notifications.sendInternalPushByUserId).toHaveBeenCalled();
    expect(hasuraSystem.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('LogEngagementSend'),
      expect.objectContaining({
        businessId: 'b1',
        pushId: 'push_catalog_stalled',
        channel: 'push',
      })
    );
  });

  it('does not send a weekly digest when tips are disabled', async () => {
    const sent = await (service as any).trySendDigestForCandidate(
      candidate({ tipsRemindersEnabled: false }),
      new Date('2026-08-13T12:00:00Z')
    );
    expect(sent).toBe(false);
    expect(notifications.sendMerchantEngagementHtmlEmail).not.toHaveBeenCalled();
  });

  it('enforces a 6-day digest cooldown', async () => {
    hasuraSystem.executeQuery.mockResolvedValue({
      recent: [],
      once: [
        {
          push_id: 'email_weekly_digest',
          sent_at: '2026-08-10T12:00:00Z',
        },
      ],
    });

    const sent = await (service as any).trySendDigestForCandidate(
      candidate(),
      new Date('2026-08-13T12:00:00Z')
    );

    expect(sent).toBe(false);
    expect(notifications.sendMerchantEngagementHtmlEmail).not.toHaveBeenCalled();
  });

  it('sends a weekly digest after the cooldown elapses', async () => {
    hasuraSystem.executeQuery.mockResolvedValue({
      recent: [],
      once: [
        {
          push_id: 'email_weekly_digest',
          sent_at: '2026-08-01T12:00:00Z',
        },
      ],
    });
    notifications.sendMerchantEngagementHtmlEmail.mockResolvedValue(true);

    const sent = await (service as any).trySendDigestForCandidate(
      candidate({ approvedItemCount: 12 }),
      new Date('2026-08-13T12:00:00Z')
    );

    expect(sent).toBe(true);
    expect(notifications.sendMerchantEngagementHtmlEmail).toHaveBeenCalled();
    expect(hasuraSystem.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('LogEngagementSend'),
      expect.objectContaining({
        pushId: 'email_weekly_digest',
        channel: 'email',
      })
    );
  });

  it('maps catalog signals including pending rentals and later catalog timestamps', () => {
    const mapped = (service as any).mapCatalogSignals({
      approved: { aggregate: { count: 3 } },
      approved_rentals: { aggregate: { count: 2 } },
      pending: { aggregate: { count: 1 } },
      pending_rentals: { aggregate: { count: 4 } },
      rejected: { aggregate: { count: 0 } },
      rejected_rentals: { aggregate: { count: 1 } },
      cleanup: { aggregate: { count: 2 } },
      views: { aggregate: { count: 9 } },
      orders: { aggregate: { count: 1 } },
      latest_item: [{ created_at: '2026-08-01T00:00:00Z' }],
      latest_rental: [{ created_at: '2026-08-10T00:00:00Z' }],
      activated: [{ created_at: '2026-07-01T00:00:00Z' }],
      top_inventory: [],
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        approvedItemCount: 3,
        approvedRentalCount: 2,
        pendingItemCount: 5,
        rejectedItemCount: 1,
        lastCatalogItemAt: '2026-08-10T00:00:00Z',
        itemsNeedingAiCleanupCount: 2,
        totalProductViews: 9,
        ordersTotal: 1,
        activatedAt: '2026-07-01T00:00:00Z',
        topViewedOutOfStockCount: 0,
      })
    );
  });

  it('counts only the top 5 viewed items that are out of stock', () => {
    const count = (service as any).countTopViewedOos([
      {
        item_id: 'a',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 10 } },
      },
      {
        item_id: 'a',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 2 } },
      },
      {
        item_id: 'b',
        computed_available_quantity: 3,
        item_view_events_aggregate: { aggregate: { count: 20 } },
      },
      {
        item_id: 'c',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 8 } },
      },
      {
        item_id: 'd',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 0 } },
      },
      {
        item_id: 'e',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 7 } },
      },
      {
        item_id: 'f',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 6 } },
      },
      {
        item_id: 'g',
        computed_available_quantity: 0,
        item_view_events_aggregate: { aggregate: { count: 5 } },
      },
    ]);

    // Top 5 by views: b(20 in stock), a(12 oos), c(8 oos), e(7 oos), f(6 oos).
    // g is outside the top 5; d has no views.
    expect(count).toBe(4);
  });
});
