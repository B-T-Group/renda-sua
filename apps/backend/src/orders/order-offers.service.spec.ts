import { ConfigService } from '@nestjs/config';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { EligibleAgentsQueryService } from '../delivery-availability/eligible-agents-query.service';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderOffersService } from './order-offers.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

describe('OrderOffersService', () => {
  let service: OrderOffersService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let commissionsService: jest.Mocked<CommissionsService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let paymentRoutingService: any;
  let agentHoldService: any;
  let offersConfig: Record<string, unknown>;
  let deliveryAvailabilityConfig: Record<string, unknown>;

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

    offersConfig = { ttlSeconds: 45, maxAgents: 2 };
    deliveryAvailabilityConfig = { enforceEnabled: true };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'orderOffers'
          ? offersConfig
          : key === 'deliveryAvailability'
            ? deliveryAvailabilityConfig
            : undefined
      ),
    } as unknown as jest.Mocked<ConfigService<Configuration>>;

    // Real query service on top of the same Hasura mock so the existing
    // agent_locations fixtures keep flowing through eligibility filtering.
    const eligibleAgentsQueryService = new EligibleAgentsQueryService(
      hasuraSystemService,
      // Fixtures always carry region addresses, so reverse-geocode is unused.
      {} as unknown as GoogleDistanceService,
      undefined,
      configService
    );

    const waitAndExecuteScheduleService = {
      scheduleDispatchRound: jest.fn().mockResolvedValue(undefined),
    } as unknown as WaitAndExecuteScheduleService;

    const deliveryConfigService = {
      getDeliveryAvailabilityRadiusKm: jest.fn().mockResolvedValue(5),
    } as unknown as DeliveryConfigService;

    paymentRoutingService = {
      resolveRailForBusiness: jest.fn().mockResolvedValue('mobile_money'),
    };
    agentHoldService = {
      resolveOrderHoldWithCeiling: jest.fn().mockResolvedValue({
        rail: 'mobile_money',
        holdPercentage: 80,
        rawHoldAmount: 4000,
        holdAmount: 4000,
        ceilingApplied: false,
        ceilingXaf: null,
      }),
    };
    service = new OrderOffersService(
      hasuraSystemService,
      commissionsService,
      notificationsService,
      configService,
      eligibleAgentsQueryService,
      waitAndExecuteScheduleService,
      deliveryConfigService,
      paymentRoutingService as any,
      agentHoldService as any
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
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('orders_by_pk')) {
            return { orders_by_pk: buildOfferOrder() };
          }
          if (query.includes('agent_locations')) {
            return { agent_locations: buildAgentLocations() };
          }
          if (query.includes('mobile_push_tokens')) {
            return {
              mobile_push_tokens: [
                { user_id: 'user-near' },
                { user_id: 'user-mid' },
                { user_id: 'user-far' },
                { user_id: 'user-wrong-region' },
              ],
            };
          }
          if (query.includes('pickup_reliability_score')) {
            return {
              agents: [
                { id: 'agent-near', pickup_reliability_score: 100 },
                { id: 'agent-mid', pickup_reliability_score: 90 },
                { id: 'agent-far', pickup_reliability_score: 80 },
              ],
            };
          }
          return {};
        }
      );
      hasuraSystemService.executeMutation.mockResolvedValue({
        insert_order_offers: { affected_rows: 2 },
        update_orders_by_pk: { id: 'order-1' },
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

    it('still offers the shop owner and client when they have agent profiles', async () => {
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('orders_by_pk')) {
            return {
              orders_by_pk: {
                ...buildOfferOrder(),
                business: {
                  name: 'Fallback Store',
                  user_id: 'user-shop-owner',
                },
                client: { user_id: 'user-client' },
              },
            };
          }
          if (query.includes('agent_locations')) {
            return {
              agent_locations: [
                buildAgentLocation('agent-shop', 'user-shop-owner', 4.01),
                buildAgentLocation('agent-client', 'user-client', 4.02),
              ],
            };
          }
          if (query.includes('mobile_push_tokens')) {
            return {
              mobile_push_tokens: [
                { user_id: 'user-shop-owner' },
                { user_id: 'user-client' },
              ],
            };
          }
          if (query.includes('pickup_reliability_score')) {
            return {
              agents: [
                { id: 'agent-shop', pickup_reliability_score: 100 },
                { id: 'agent-client', pickup_reliability_score: 95 },
              ],
            };
          }
          return {};
        }
      );
      hasuraSystemService.executeMutation.mockResolvedValue({
        insert_order_offers: { affected_rows: 2 },
        update_orders_by_pk: { id: 'order-1' },
      });
      commissionsService.calculateAgentEarnings.mockResolvedValue({
        totalEarnings: 42.6,
        currency: 'XAF',
      } as any);
      notificationsService.sendOrderOfferPush.mockResolvedValue(undefined);

      await service.dispatchOrderOffers('order-1');

      expect(getInsertedOffers().map((offer) => offer.user_id)).toEqual([
        'user-shop-owner',
        'user-client',
      ]);
      expect(notificationsService.sendOrderOfferPush).toHaveBeenCalledTimes(2);
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
          offerKind: 'standard',
          pickup: {
            businessName: 'Downtown Pickup',
            locationName: 'Downtown Pickup',
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

  describe('#594 G3: offerKind and pickup.locationName', () => {
    const queryOf = () => hasuraSystemService.executeQuery.mock.calls[0][0] as string;

    it.each([
      ['dedicated', 'dedicated'],
      ['standard', 'standard'],
      [null, 'standard'],
      [undefined, 'standard'],
      ['weird', 'standard'],
    ])('offer_kind %p -> offerKind %p on the offer payload (selected in the query)', async (kind, expected) => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        order_offers: [{ ...buildOfferDetailsRow('2026-01-01T00:01:00.000Z'), offer_kind: kind }],
      });
      const result = await service.getOfferDetailsForAgent('order-1', 'agent-near');
      expect(result.offer?.offerKind).toBe(expected);
      expect(queryOf()).toMatch(/\boffer_kind\b/);
    });

    it('pending offer carries offerKind too; locationName is the store, businessName unchanged', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        order_offers: [{ ...buildOfferDetailsRow('2026-01-01T00:01:00.000Z'), offer_kind: 'dedicated' }],
      });
      const result = await service.getPendingOfferForAgent('agent-near');
      expect(queryOf()).toContain('query PendingOffer');
      expect(queryOf()).toMatch(/\boffer_kind\b/);
      expect(result.offer).toMatchObject({
        offerKind: 'dedicated',
        pickup: { businessName: 'Downtown Pickup', locationName: 'Downtown Pickup' },
      });
    });

    it('no location name: businessName falls back to the business, locationName is null', async () => {
      const row = buildOfferDetailsRow('2026-01-01T00:01:00.000Z');
      row.order.business_location.name = '';
      hasuraSystemService.executeQuery.mockResolvedValueOnce({ order_offers: [row] });
      const result = await service.getOfferDetailsForAgent('order-1', 'agent-near');
      expect(result.offer?.pickup).toMatchObject({ businessName: 'Fallback Store', locationName: null });
    });
  });

  describe('#594 DEV QA F1: markOfferLost', () => {
    it('cancels (not expires) the caller\'s open offer, only when the order is another agent\'s', async () => {
      hasuraSystemService.executeMutation.mockResolvedValueOnce({ update_order_offers: { affected_rows: 1 } });
      await service.markOfferLost('order-1', 'agent-1');
      const [mutation, vars] = hasuraSystemService.executeMutation.mock.calls[0] as [string, Record<string, unknown>];
      expect(vars).toEqual({ orderId: 'order-1', agentId: 'agent-1' });
      expect(mutation).toContain('_set: { status: "cancelled"');
      expect(mutation).not.toContain('"expired"');
      // A duplicate accept by the winner itself leaves its offer for handleOrderAssigned.
      expect(mutation.replace(/\s+/g, ' ')).toContain('{ order: { assigned_agent_id: { _is_null: false, _neq: $agentId } } }');
      expect(mutation).toContain('{ status: { _eq: "offered" } }');
    });
  });

  describe('handleOrderAssigned', () => {
    it('accepts the winner offer, cancels siblings, and dismisses losing agents', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        agents_by_pk: { user_id: 'user-winner' },
      });
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

    it('does not send already-taken push to the winning courier user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        agents_by_pk: { user_id: 'user-winner' },
      });
      hasuraSystemService.executeMutation
        .mockResolvedValueOnce({ update_order_offers: { affected_rows: 1 } })
        .mockResolvedValueOnce({
          update_order_offers: {
            returning: [
              { user_id: 'user-winner' },
              { user_id: 'user-loser-1' },
            ],
          },
        });
      notificationsService.sendOrderOfferCancelledPush.mockResolvedValue(
        undefined
      );

      await service.handleOrderAssigned('order-1', 'agent-winner');

      expect(
        notificationsService.sendOrderOfferCancelledPush
      ).toHaveBeenCalledTimes(1);
      expect(notificationsService.sendOrderOfferCancelledPush).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-loser-1' })
      );
    });

    it('still finalizes offers if winner user lookup fails', async () => {
      hasuraSystemService.executeQuery.mockRejectedValueOnce(
        new Error('hasura timeout')
      );
      hasuraSystemService.executeMutation
        .mockResolvedValueOnce({ update_order_offers: { affected_rows: 1 } })
        .mockResolvedValueOnce({
          update_order_offers: {
            returning: [{ user_id: 'user-loser-1' }],
          },
        });
      notificationsService.sendOrderOfferCancelledPush.mockResolvedValue(
        undefined
      );

      await service.handleOrderAssigned('order-1', 'agent-winner');

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledTimes(2);
      expect(
        notificationsService.sendOrderOfferCancelledPush
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('round radius (round1RadiusKm / round2RadiusKm)', () => {
    // Pickup at lat 4, lon 9. 0.01 deg lat ~= 1.11 km.
    function mockDispatch(
      agents: ReturnType<typeof buildAgentLocation>[],
      orderOverrides: Record<string, unknown> = {}
    ) {
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('orders_by_pk')) {
            return { orders_by_pk: { ...buildOfferOrder(), ...orderOverrides } };
          }
          if (query.includes('agent_locations')) {
            return { agent_locations: agents };
          }
          if (query.includes('mobile_push_tokens')) {
            return {
              mobile_push_tokens: agents.map((a) => ({ user_id: a.agent.user.id })),
            };
          }
          if (query.includes('pickup_reliability_score')) {
            return {
              agents: agents.map((a) => ({
                id: a.agent.id,
                pickup_reliability_score: 100,
              })),
            };
          }
          return {};
        }
      );
      hasuraSystemService.executeMutation.mockResolvedValue({
        insert_order_offers: { affected_rows: 1 },
        update_orders_by_pk: { id: 'order-1' },
      });
      commissionsService.calculateAgentEarnings.mockResolvedValue({
        totalEarnings: 400,
        currency: 'XAF',
      } as any);
      notificationsService.sendOrderOfferPush.mockResolvedValue(undefined);
    }

    const agents = () => [
      buildAgentLocation('agent-3km', 'user-3km', 4.027),
      buildAgentLocation('agent-7km', 'user-7km', 4.063),
      buildAgentLocation('agent-15km', 'user-15km', 4.135),
      buildAgentLocation('agent-30km', 'user-30km', 4.27),
    ];

    beforeEach(() => {
      offersConfig = { ttlSeconds: 45, maxAgents: 10 };
    });

    it('round 1 defaults to the country checkout radius when round1RadiusKm is unset', async () => {
      mockDispatch(agents());

      await service.runDispatchRound('order-1', 1);

      expect(getInsertedOffers().map((o: any) => o.agent_id)).toEqual([
        'agent-3km',
      ]);
    });

    it('round 1 reads round1RadiusKm when configured', async () => {
      offersConfig = { ...offersConfig, round1RadiusKm: 8 };
      mockDispatch(agents());

      await service.runDispatchRound('order-1', 1);

      expect(getInsertedOffers().map((o: any) => o.agent_id)).toEqual([
        'agent-3km',
        'agent-7km',
      ]);
    });

    it('round 2 keeps the round 1 radius when round2RadiusKm is unset (no silent widening)', async () => {
      mockDispatch(agents(), { dispatch_round: 1 });

      await service.runDispatchRound('order-1', 2);

      expect(getInsertedOffers().map((o: any) => o.agent_id)).toEqual([
        'agent-3km',
      ]);
    });

    it('round 2 widens to round2RadiusKm when configured', async () => {
      offersConfig = { ...offersConfig, round2RadiusKm: 20 };
      mockDispatch(agents(), { dispatch_round: 1 });

      await service.runDispatchRound('order-1', 2);

      expect(getInsertedOffers().map((o: any) => o.agent_id)).toEqual([
        'agent-3km',
        'agent-7km',
        'agent-15km',
      ]);
    });

    it('does not offer agents whose last GPS update is older than the configured 30 minutes', async () => {
      deliveryAvailabilityConfig = {
        enforceEnabled: true,
        agentLocationMaxAgeMinutes: 30,
      };
      const stale = new Date(now.getTime() - 31 * 60 * 1000).toISOString();
      mockDispatch([
        buildAgentLocation('agent-stale', 'user-stale', 4.005, {
          updated_at: stale,
        }),
        buildAgentLocation('agent-fresh', 'user-fresh', 4.02),
      ]);

      await service.runDispatchRound('order-1', 1);

      expect(getInsertedOffers().map((o: any) => o.agent_id)).toEqual([
        'agent-fresh',
      ]);
      expect(notificationsService.sendOrderOfferPush).toHaveBeenCalledTimes(1);
      expect(notificationsService.sendOrderOfferPush).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-fresh' })
      );
    });

    it('still offers a stale-GPS agent when the cutoff is off (default)', async () => {
      const stale = new Date(now.getTime() - 31 * 60 * 1000).toISOString();
      mockDispatch([
        buildAgentLocation('agent-stale', 'user-stale', 4.005, {
          updated_at: stale,
        }),
      ]);

      await service.runDispatchRound('order-1', 1);

      expect(getInsertedOffers().map((o: any) => o.agent_id)).toEqual([
        'agent-stale',
      ]);
    });
  });

  function getInsertedOffers() {
    const call = hasuraSystemService.executeMutation.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('insert_order_offers') &&
        c[1]?.objects
    );
    return call?.[1]?.objects ?? [];
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
      buildAgentLocation('agent-mid', 'user-mid', 4.03),
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
      updated_at:
        (overrides.updated_at as string | undefined) ?? now.toISOString(),
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
      created_at: new Date(new Date(expiresAt).getTime() - 180_000).toISOString(),
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
