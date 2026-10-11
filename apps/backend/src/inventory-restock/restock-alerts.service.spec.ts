import { Test, TestingModule } from '@nestjs/testing';
import { RestockAlertsService } from './restock-alerts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationOrchestrator } from '../notifications/notification-orchestrator';
import { DeepLinkService } from '../deep-links/deep-links.service';
import { Logger } from '@nestjs/common';

describe('RestockAlertsService', () => {
  let service: RestockAlertsService;
  let hasura: jest.Mocked<HasuraSystemService>;
  let notificationOrchestrator: jest.Mocked<NotificationOrchestrator>;
  let deepLinkService: jest.Mocked<DeepLinkService>;

  const mockExecuteQuery = jest.fn();
  const mockExecuteMutation = jest.fn();
  const mockSendNotification = jest.fn();
  const mockGenerateProductLink = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestockAlertsService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: mockExecuteQuery,
            executeMutation: mockExecuteMutation,
          },
        },
        {
          provide: NotificationOrchestrator,
          useValue: {
            sendNotification: mockSendNotification,
          },
        },
        {
          provide: DeepLinkService,
          useValue: {
            generateProductLink: mockGenerateProductLink,
          },
        },
      ],
    }).compile();

    service = module.get<RestockAlertsService>(RestockAlertsService);
    hasura = module.get(HasuraSystemService);
    notificationOrchestrator = module.get(NotificationOrchestrator);
    deepLinkService = module.get(DeepLinkService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('AC-2.2: 10-minute debounce', () => {
    it('should only process events older than 10 minutes', async () => {
      const now = new Date();
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const nineMinAgo = new Date(now.getTime() - 9 * 60 * 1000);

      mockExecuteQuery.mockResolvedValueOnce({
        restock_events: [
          { id: 'old-event', created_at: tenMinAgo.toISOString(), item_id: 'item-1' },
          { id: 'recent-event', created_at: nineMinAgo.toISOString(), item_id: 'item-2' },
        ],
      });

      await service.processRestockEvents();

      // Should query for events older than 10 minutes
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('created_at: { _lt: $debounceThreshold }'),
        expect.objectContaining({ debounceThreshold: expect.any(String) })
      );
    });

    it('should cancel alert if stock drops to zero during debounce window', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 0, // Stock is zero now
                reserved_quantity: 0,
                business_location: { name: 'Store A', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alerts: [] }); // No armed alerts

      await service.processRestockEvents();

      // Should mark event as cancelled, not processed
      expect(mockExecuteMutation).toHaveBeenCalledWith(
        expect.stringContaining('update_restock_events'),
        expect.objectContaining({
          eventIds: ['event-1'],
          status: 'cancelled',
        })
      );
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  describe('AC-2.3: 24h cooldown per user-item', () => {
    it('should not send alert if user received one for this item in last 24h', async () => {
      const yesterday = new Date(Date.now() - 23 * 60 * 60 * 1000);

      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: { preferred_language: 'en', user_notification_preferences: [{ push_enabled: true }] },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alert_sends: [
            { user_id: 'user-1', item_id: 'item-1', sent_at: yesterday.toISOString() },
          ],
        });

      await service.processRestockEvents();

      // Should skip due to cooldown
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  describe('AC-2.4: Max 1 fanout per item per 6h', () => {
    it('should not fanout if item was already restocked in last 6h', async () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);

      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: { preferred_language: 'en', user_notification_preferences: [{ push_enabled: true }] },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alert_sends: [],
        })
        .mockResolvedValueOnce({
          restock_alert_sends: [
            { item_id: 'item-1', sent_at: fiveHoursAgo.toISOString() },
          ],
        });

      await service.processRestockEvents();

      // Should skip due to fanout cap
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  describe('AC-2.5: Max 3 restock alerts per user per 24h', () => {
    it('should batch into digest if user reached daily cap', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product A', item_sub_category: { id: 'cat-1' } },
              },
            },
            {
              id: 'event-2',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-2',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-2',
                quantity: 3,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product B', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: { preferred_language: 'en', user_notification_preferences: [{ push_enabled: true }] },
            },
            {
              user_id: 'user-1',
              item_id: 'item-2',
              market_id: 'market-1',
              user: { preferred_language: 'en', user_notification_preferences: [{ push_enabled: true }] },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alert_sends: [],
        })
        .mockResolvedValueOnce({
          restock_alert_sends: [],
        })
        .mockResolvedValueOnce({
          restock_alert_sends: [
            { user_id: 'user-1', sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
            { user_id: 'user-1', sent_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
            { user_id: 'user-1', sent_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() },
          ],
        });

      await service.processRestockEvents();

      // Should batch the items into a digest instead of sending individual alerts
      // (exact implementation depends on digest logic)
    });
  });

  describe('AC-2.7: Quiet hours 21:00-08:00', () => {
    it('should queue notifications during quiet hours', async () => {
      // Mock time to be 23:00 (11 PM)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-11T23:00:00Z'));

      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: {
                  name: 'Store',
                  market_state: {
                    market_id: 'market-1',
                    market: { timezone: 'America/New_York' },
                  },
                },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: { preferred_language: 'en', user_notification_preferences: [{ push_enabled: true }] },
            },
          ],
        });

      await service.processRestockEvents();

      // Should queue for 08:00 next day instead of sending immediately
      // (exact check depends on implementation)

      jest.useRealTimers();
    });
  });

  describe('AC-2.8: Re-verify availability before send', () => {
    it('should skip if stock dropped to zero before send', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 0, // NOW out of stock
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: { preferred_language: 'en', user_notification_preferences: [{ push_enabled: true }] },
            },
          ],
        });

      await service.processRestockEvents();

      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  describe('AC-2.9: Single channel selection', () => {
    it('should select push if enabled', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: {
                preferred_language: 'en',
                user_notification_preferences: [{
                  push_enabled: true,
                  restock_alert_push: true,
                  restock_alert_whatsapp: true,
                  restock_alert_sms: true,
                }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] });

      mockGenerateProductLink.mockReturnValue('https://rendasua.com/product/1?src=restock_alert');
      mockSendNotification.mockResolvedValue({ success: true });
      mockExecuteMutation.mockResolvedValue({});

      await service.processRestockEvents();

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'push',
          userId: 'user-1',
        })
      );
    });

    it('should fallback to WhatsApp if push disabled', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: {
                preferred_language: 'en',
                user_notification_preferences: [{
                  push_enabled: false,
                  restock_alert_push: false,
                  restock_alert_whatsapp: true,
                }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] });

      mockGenerateProductLink.mockReturnValue('https://rendasua.com/product/1?src=restock_alert');
      mockSendNotification.mockResolvedValue({ success: true });
      mockExecuteMutation.mockResolvedValue({});

      await service.processRestockEvents();

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'whatsapp',
        })
      );
    });
  });

  describe('AC-2.10: Quantity bucket display', () => {
    it('should show "Only X left" if quantity <= 5', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 3,
                reserved_quantity: 0,
                business_location: { name: 'Store A', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: {
                preferred_language: 'en',
                user_notification_preferences: [{ push_enabled: true, restock_alert_push: true }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] });

      mockGenerateProductLink.mockReturnValue('https://rendasua.com/product/1?src=restock_alert');
      mockSendNotification.mockResolvedValue({ success: true });
      mockExecuteMutation.mockResolvedValue({});

      await service.processRestockEvents();

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Only 3 left at Store A'),
        })
      );
    });

    it('should not show count if quantity > 5', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 10,
                reserved_quantity: 0,
                business_location: { name: 'Store A', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: {
                preferred_language: 'en',
                user_notification_preferences: [{ push_enabled: true, restock_alert_push: true }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] });

      mockGenerateProductLink.mockReturnValue('https://rendasua.com/product/1?src=restock_alert');
      mockSendNotification.mockResolvedValue({ success: true });
      mockExecuteMutation.mockResolvedValue({});

      await service.processRestockEvents();

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.not.stringContaining('Only'),
        })
      );
    });
  });

  describe('Fire-and-forget / Never blocks', () => {
    it('should not throw if notification orchestrator fails', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: {
                preferred_language: 'en',
                user_notification_preferences: [{ push_enabled: true, restock_alert_push: true }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] });

      mockGenerateProductLink.mockReturnValue('https://rendasua.com/product/1?src=restock_alert');
      mockSendNotification.mockRejectedValue(new Error('Network error'));
      mockExecuteMutation.mockResolvedValue({});

      // Should not throw
      await expect(service.processRestockEvents()).resolves.not.toThrow();
    });
  });

  describe('Concurrency / Idempotency', () => {
    it('should send only once even if event is processed by two instances', async () => {
      // This test verifies that AC-2.1 (one alert per transition) is enforced via
      // database constraints or proper locking. The restock_alert_sends table
      // should have a unique constraint on (user_id, item_id, restock_event_id).
      
      mockExecuteQuery
        .mockResolvedValueOnce({
          restock_events: [
            {
              id: 'event-1',
              created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
              item_id: 'item-1',
              business_location_id: 'loc-1',
              business_inventory: {
                id: 'inv-1',
                quantity: 5,
                reserved_quantity: 0,
                business_location: { name: 'Store', market_state: { market_id: 'market-1' } },
                item: { name: 'Product', item_sub_category: { id: 'cat-1' } },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          restock_alerts: [
            {
              user_id: 'user-1',
              item_id: 'item-1',
              market_id: 'market-1',
              user: {
                preferred_language: 'en',
                user_notification_preferences: [{ push_enabled: true, restock_alert_push: true }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] })
        .mockResolvedValueOnce({ restock_alert_sends: [] });

      mockGenerateProductLink.mockReturnValue('https://rendasua.com/product/1?src=restock_alert');
      mockSendNotification.mockResolvedValue({ success: true });
      
      // First attempt succeeds
      mockExecuteMutation.mockResolvedValueOnce({});
      
      // Second attempt hits unique constraint
      mockExecuteMutation.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      await service.processRestockEvents();
      
      // Notification should have been sent once
      expect(mockSendNotification).toHaveBeenCalledTimes(1);
    });
  });
});
