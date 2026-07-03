import { ConfigService } from '@nestjs/config';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderOffersService } from './order-offers.service';

describe('OrderOffersService', () => {
  let service: OrderOffersService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let commissionsService: jest.Mocked<CommissionsService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  const now = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    } as unknown as jest.Mocked<HasuraSystemService>;
    commissionsService = {
      calculateAgentEarnings: jest.fn(),
    } as unknown as jest.Mocked<CommissionsService>;
    notificationsService = {
      sendOrderOfferPush: jest.fn(),
      sendOrderOfferCancelledPush: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    const configService = {
      get: jest.fn((key: string) =>
        key === 'orderOffers' ? { ttlSeconds: 45, maxAgents: 2 } : undefined
      ),
    } as unknown as jest.Mocked<ConfigService<Configuration>>;

    service = new OrderOffersService(
      hasuraSystemService,
      commissionsService,
      notificationsService,
      configService
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('dispatchOrderOffers', () => {
    it('skips dispatch when offers already exist for the order', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        order_offers: [{ id: 'offer-existing' }],
      });

      await service.dispatchOrderOffers('order-1');

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledTimes(1);
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
      expect(notificationsService.sendOrderOfferPush).not.toHaveBeenCalled();
    });

    it('inserts and pushes offers to the nearest eligible token-enabled agents', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ order_offers: [] })
        .mockResolvedValueOnce({ orders_by_pk: buildOfferOrder() })
        .mockResolvedValueOnce({ agent_locations: buildAgentLocations() })
        .mockResolvedValueOnce({
          mobile_push_tokens: [
            { user_id: 'user-near' },
            { user_id: 'user-mid' },
            { user_id: 'user-far' },
            { user_id: 'user-wrong-region' },
          ],
        });
      hasuraSystemService.executeMutation.mockResolvedValueOnce({
        insert_order_offers: { affected_rows: 2 },
      });
      commissionsService.calculateAgentEarnings.mockResolvedValue({
        totalEarnings: 42.6,
        currency: 'XAF',
      } as any);
      notificationsService.sendOrderOfferPush.mockResolvedValue(undefined);

      await service.dispatchOrderOffers('order-1');

      const insertedOffers = getInsertedOffers();
      expect(insertedOffers.map((offer) => offer.agent_id)).toEqual([
        'agent-near',
        'agent-mid',
      ]);
      expect(insertedOffers).toEqual([
        expect.objectContaining({
          order_id: 'order-1',
          user_id: 'user-near',
          status: 'offered',
          estimated_earnings: 42.6,
          currency: 'XAF',
          expires_at: '2026-01-01T00:00:45.000Z',
        }),
        expect.objectContaining({
          order_id: 'order-1',
          user_id: 'user-mid',
          status: 'offered',
          estimated_earnings: 42.6,
          currency: 'XAF',
          expires_at: '2026-01-01T00:00:45.000Z',
        }),
      ]);
      expect(
        insertedOffers[0].distance_km < insertedOffers[1].distance_km
      ).toBe(true);
      expect(notificationsService.sendOrderOfferPush).toHaveBeenCalledTimes(2);
      expect(notificationsService.sendOrderOfferPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-near',
          title: 'New delivery available',
          orderId: 'order-1',
          expiresAt: '2026-01-01T00:00:45.000Z',
          ttlSeconds: 45,
        })
      );
      expect(
        notificationsService.sendOrderOfferPush.mock.calls[0][0].body
      ).toContain('Est. 43 XAF');
    });
  });

  describe('getOfferDetailsForAgent', () => {
    it('returns an active offer payload when the offer is live and order is claimable', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        order_offers: [buildOfferDetailsRow('2026-01-01T00:01:00.000Z')],
      });

      const result = await service.getOfferDetailsForAgent(
        'order-1',
        'agent-near'
      );

      expect(result).toEqual({
        success: true,
        active: true,
        offer: expect.objectContaining({
          orderId: 'order-1',
          orderNumber: 'ORD-1',
          expiresAt: '2026-01-01T00:01:00.000Z',
          distanceKm: 1.23,
          estimatedEarnings: 42.6,
          currency: 'XAF',
          estimatedDeliveryMinutes: expect.any(Number),
          pickup: {
            businessName: 'Downtown Pickup',
            city: 'Douala',
            state: 'Littoral',
          },
          dropoff: { city: 'Bonaberi', state: 'Littoral' },
        }),
      });
    });

    it('marks the offer inactive when it is expired', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        order_offers: [buildOfferDetailsRow('2025-12-31T23:59:59.000Z')],
      });

      const result = await service.getOfferDetailsForAgent(
        'order-1',
        'agent-near'
      );

      expect(result.active).toBe(false);
      expect(result.offer?.orderId).toBe('order-1');
    });
  });

  describe('handleOrderAssigned', () => {
    it('accepts the winner offer, cancels siblings, and dismisses losing agents', async () => {
      hasuraSystemService.executeMutation
        .mockResolvedValueOnce({ update_order_offers: { affected_rows: 1 } })
        .mockResolvedValueOnce({
          update_order_offers: {
            returning: [{ user_id: 'user-loser-1' }, { user_id: 'user-loser-2' }],
          },
        });
      notificationsService.sendOrderOfferCancelledPush.mockResolvedValue(
        undefined
      );

      await service.handleOrderAssigned('order-1', 'agent-winner');

      expect(hasuraSystemService.executeMutation).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('status: "accepted"'),
        { orderId: 'order-1', agentId: 'agent-winner' }
      );
      expect(hasuraSystemService.executeMutation).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('status: "cancelled"'),
        { orderId: 'order-1', agentId: 'agent-winner' }
      );
      expect(
        notificationsService.sendOrderOfferCancelledPush
      ).toHaveBeenCalledTimes(2);
      expect(notificationsService.sendOrderOfferCancelledPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-loser-1',
          orderId: 'order-1',
          title: 'Delivery already taken',
        })
      );
    });
  });

  function getInsertedOffers() {
    return hasuraSystemService.executeMutation.mock.calls[0][1].objects;
  }

  function buildOfferOrder() {
    return {
      id: 'order-1',
      order_number: 'ORD-1',
      current_status: 'ready_for_pickup',
      assigned_agent_id: null,
      fulfillment_method: 'delivery',
      currency: 'XAF',
      verified_agent_delivery: false,
      business: { name: 'Fallback Store' },
      business_location: {
        name: 'Downtown Pickup',
        address: {
          country: 'CM',
          state: 'Littoral',
          latitude: 4,
          longitude: 9,
        },
      },
    };
  }

  function buildAgentLocations() {
    return [
      buildAgentLocation('agent-far', 'user-far', 4.2),
      buildAgentLocation('agent-mid', 'user-mid', 4.05),
      buildAgentLocation('agent-near', 'user-near', 4.01),
      buildAgentLocation('agent-no-token', 'user-no-token', 4.005),
      buildAgentLocation('agent-unverified', 'user-unverified', 4.001, {
        is_verified: false,
      }),
      buildAgentLocation('agent-unavailable', 'user-unavailable', 4.002, {
        is_available: false,
      }),
      buildAgentLocation('agent-suspended', 'user-suspended', 4.003, {
        status: 'suspended',
      }),
      buildAgentLocation('agent-wrong-region', 'user-wrong-region', 4.004, {
        country: 'SN',
        state: 'Dakar',
      }),
    ];
  }

  function buildAgentLocation(
    agentId: string,
    userId: string,
    latitude: number,
    overrides: Record<string, unknown> = {}
  ) {
    const country = (overrides.country as string) ?? 'CM';
    const state = (overrides.state as string) ?? 'Littoral';
    return {
      latitude,
      longitude: 9,
      agent: {
        id: agentId,
        is_available: overrides.is_available ?? true,
        is_verified: overrides.is_verified ?? true,
        is_internal: overrides.is_internal ?? false,
        status: overrides.status ?? 'active',
        user: { id: userId },
        agent_addresses: [
          {
            address: {
              country,
              state,
              is_primary: true,
            },
          },
        ],
      },
    };
  }

  function buildOfferDetailsRow(expiresAt: string) {
    return {
      status: 'offered',
      distance_km: '1.23',
      estimated_earnings: '42.6',
      currency: 'XAF',
      expires_at: expiresAt,
      order: {
        id: 'order-1',
        order_number: 'ORD-1',
        current_status: 'ready_for_pickup',
        assigned_agent_id: null,
        business: { name: 'Fallback Store' },
        business_location: {
          name: 'Downtown Pickup',
          address: {
            city: 'Douala',
            state: 'Littoral',
            latitude: 4,
            longitude: 9,
          },
        },
        delivery_address: {
          city: 'Bonaberi',
          state: 'Littoral',
          latitude: 4.08,
          longitude: 9.7,
        },
      },
    };
  }
});
