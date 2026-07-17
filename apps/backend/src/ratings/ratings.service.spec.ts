import { BadRequestException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RatingType } from './dto/create-rating.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('RatingsService', () => {
  const orderBase = {
    id: 'order-1',
    order_number: 'ORD-1',
    client_id: 'client-1',
    business_id: 'business-1',
    assigned_agent_id: 'agent-1',
    current_status: 'complete',
    created_at: '2026-07-01T00:00:00.000Z',
    completed_at: new Date(Date.now() - 8 * DAY_MS).toISOString(),
    order_items: [
      { item_id: 'item-1', item_name: 'Item One' },
      { item_id: 'item-2', item_name: 'Item Two' },
    ],
  };

  const clientProfile = {
    id: 'user-client',
    first_name: 'Cli',
    last_name: 'Ent',
    client: { id: 'client-1' },
  };

  const agentProfile = {
    id: 'user-agent',
    first_name: 'Age',
    last_name: 'Nt',
    agent: { id: 'agent-1' },
  };

  function buildService(overrides: {
    order?: any;
    profile?: any;
    ratings?: any[];
  }) {
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('GetOrder(')) {
        return { orders_by_pk: overrides.order ?? orderBase };
      }
      if (query.includes('GetUserProfile')) {
        return { users_by_pk: overrides.profile ?? clientProfile };
      }
      if (query.includes('GetRatingsForOrder')) {
        return { ratings: overrides.ratings ?? [] };
      }
      if (query.includes('GetExistingRating')) {
        return { ratings: [] };
      }
      if (query.includes('Validate')) {
        return { items_by_pk: { id: 'item-1' } };
      }
      return {};
    });
    const hasura = {
      executeQuery,
      executeMutation: jest.fn(async () => ({
        insert_ratings_one: { id: 'rating-1' },
      })),
    } as any;
    const notifications = { sendRatingReceivedPush: jest.fn() } as any;
    const config = {
      get: jest.fn(() => ({ itemRatingDelayDays: 7 })),
    } as any;
    return new RatingsService(hasura, notifications, config);
  }

  describe('getOrderRatingEligibility', () => {
    it('lets the client rate agent and items once the delay elapsed', async () => {
      const service = buildService({});

      const eligibility = await service.getOrderRatingEligibility(
        'order-1',
        'user-client'
      );

      expect(eligibility.canRateAgent).toBe(true);
      expect(eligibility.canRateItem).toBe(true);
      expect(eligibility.canRateClient).toBe(false);
      expect(eligibility.agentId).toBe('agent-1');
      expect(eligibility.items).toEqual([
        { id: 'item-1', name: 'Item One', rated: false },
        { id: 'item-2', name: 'Item Two', rated: false },
      ]);
    });

    it('locks item rating before the delay and reports the unlock time', async () => {
      const completedAt = new Date(Date.now() - 1 * DAY_MS).toISOString();
      const service = buildService({
        order: { ...orderBase, completed_at: completedAt },
      });

      const eligibility = await service.getOrderRatingEligibility(
        'order-1',
        'user-client'
      );

      expect(eligibility.canRateItem).toBe(false);
      expect(eligibility.canRateAgent).toBe(true);
      expect(eligibility.itemRatingUnlocksAt).toBe(
        new Date(new Date(completedAt).getTime() + 7 * DAY_MS).toISOString()
      );
    });

    it('hides CTAs the client already used and tracks per-item state', async () => {
      const service = buildService({
        ratings: [
          {
            rating_type: 'client_to_agent',
            rater_user_id: 'user-client',
            rated_entity_id: 'agent-1',
          },
          {
            rating_type: 'client_to_item',
            rater_user_id: 'user-client',
            rated_entity_id: 'item-1',
          },
        ],
      });

      const eligibility = await service.getOrderRatingEligibility(
        'order-1',
        'user-client'
      );

      expect(eligibility.canRateAgent).toBe(false);
      // item-2 is still unrated
      expect(eligibility.canRateItem).toBe(true);
      expect(eligibility.items).toEqual([
        { id: 'item-1', name: 'Item One', rated: true },
        { id: 'item-2', name: 'Item Two', rated: false },
      ]);
    });

    it('only offers rate-client to the assigned agent on complete orders', async () => {
      const service = buildService({ profile: agentProfile });

      const eligibility = await service.getOrderRatingEligibility(
        'order-1',
        'user-agent'
      );

      expect(eligibility.canRateClient).toBe(true);
      expect(eligibility.canRateAgent).toBe(false);
      expect(eligibility.canRateItem).toBe(false);
    });

    it('offers nothing while the order is not complete', async () => {
      const service = buildService({
        order: {
          ...orderBase,
          current_status: 'out_for_delivery',
          completed_at: null,
        },
      });

      const eligibility = await service.getOrderRatingEligibility(
        'order-1',
        'user-client'
      );

      expect(eligibility.canRateAgent).toBe(false);
      expect(eligibility.canRateItem).toBe(false);
      expect(eligibility.itemRatingUnlocksAt).toBeNull();
    });
  });

  describe('createRating client_to_item delay gate', () => {
    const itemRatingDto = {
      orderId: 'order-1',
      ratingType: RatingType.CLIENT_TO_ITEM,
      ratedEntityType: 'item' as any,
      ratedEntityId: 'item-1',
      rating: 5,
    } as any;

    it('rejects item ratings before the delay elapsed', async () => {
      const service = buildService({
        order: {
          ...orderBase,
          completed_at: new Date(Date.now() - 2 * DAY_MS).toISOString(),
        },
      });

      await expect(
        service.createRating(itemRatingDto, 'user-client')
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects item ratings for items outside the order', async () => {
      const service = buildService({});

      await expect(
        service.createRating(
          { ...itemRatingDto, ratedEntityId: 'other-item' },
          'user-client'
        )
      ).rejects.toThrow('Item is not part of this order');
    });

    it('accepts item ratings after the delay elapsed', async () => {
      const service = buildService({});

      const rating = await service.createRating(itemRatingDto, 'user-client');

      expect(rating).toEqual({ id: 'rating-1' });
    });
  });
});
