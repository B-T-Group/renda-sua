import { RecipientResolutionService } from './recipient-resolution.service';
import type { MessagingOrder } from './messaging.types';

function makeOrder(overrides: Partial<MessagingOrder> = {}): MessagingOrder {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    business_id: 'biz-1',
    client_id: 'client-1',
    assigned_agent_id: 'agent-1',
    client: { user_id: 'client-user-1' },
    business: { user_id: 'biz-user-1' },
    assigned_agent: { user_id: 'agent-user-1' },
    ...overrides,
  };
}

describe('RecipientResolutionService', () => {
  let service: RecipientResolutionService;

  beforeEach(() => {
    service = new RecipientResolutionService();
  });

  describe('with a mention', () => {
    it('routes to the mentioned user regardless of sender persona', () => {
      const result = service.resolve(makeOrder(), 'client', 'biz-user-1');
      expect(result).toEqual([{ userId: 'biz-user-1', type: 'mentioned' }]);
    });
  });

  describe('default routing (no mention)', () => {
    it('client ? assigned agent when agent is present', () => {
      const result = service.resolve(makeOrder(), 'client');
      expect(result).toEqual([{ userId: 'agent-user-1', type: 'default_route' }]);
    });

    it('client ? business when no agent assigned', () => {
      const order = makeOrder({ assigned_agent_id: null, assigned_agent: null });
      const result = service.resolve(order, 'client');
      expect(result).toEqual([{ userId: 'biz-user-1', type: 'default_route' }]);
    });

    it('business ? client', () => {
      const result = service.resolve(makeOrder(), 'business');
      expect(result).toEqual([{ userId: 'client-user-1', type: 'default_route' }]);
    });

    it('agent ? client', () => {
      const result = service.resolve(makeOrder(), 'agent');
      expect(result).toEqual([{ userId: 'client-user-1', type: 'default_route' }]);
    });

    it('returns empty when client has no user_id', () => {
      const order = makeOrder({ client: { user_id: null } });
      const result = service.resolve(order, 'business');
      expect(result).toEqual([]);
    });
  });
});
