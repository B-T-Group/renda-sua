import { OrderParticipantsService } from './order-participants.service';
import type { MessagingOrder } from './messaging.types';

function makeOrder(overrides: Partial<MessagingOrder> = {}): MessagingOrder {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    business_id: 'biz-1',
    client_id: 'client-1',
    assigned_agent_id: 'agent-1',
    client: { user_id: 'client-user-1', user: { first_name: 'Alice', last_name: 'C' } },
    business: { user_id: 'biz-user-1', user: { first_name: 'Bob', last_name: 'B' } },
    assigned_agent: { user_id: 'agent-user-1', user: { first_name: 'Carol', last_name: 'A' } },
    ...overrides,
  };
}

describe('OrderParticipantsService', () => {
  let service: OrderParticipantsService;

  beforeEach(() => {
    service = new OrderParticipantsService();
  });

  describe('getParticipants', () => {
    it('returns all three participants when all present', () => {
      const result = service.getParticipants(makeOrder());
      expect(result).toHaveLength(3);
      const personas = result.map((p) => p.persona);
      expect(personas).toContain('client');
      expect(personas).toContain('business');
      expect(personas).toContain('agent');
    });

    it('omits agent when not assigned', () => {
      const order = makeOrder({ assigned_agent_id: null, assigned_agent: null });
      const result = service.getParticipants(order);
      const personas = result.map((p) => p.persona);
      expect(personas).not.toContain('agent');
    });
  });

  describe('getMentionableParticipants', () => {
    it('excludes the requesting user and returns only allowed personas for client', () => {
      const result = service.getMentionableParticipants(makeOrder(), 'client-user-1', 'client');
      expect(result.find((p) => p.userId === 'client-user-1')).toBeUndefined();
      const personas = result.map((p) => p.persona);
      expect(personas).toContain('agent');
      expect(personas).toContain('business');
    });

    it('only returns client for agent sender', () => {
      const result = service.getMentionableParticipants(makeOrder(), 'agent-user-1', 'agent');
      const personas = result.map((p) => p.persona);
      expect(personas).toContain('client');
      expect(personas).toContain('business');
      expect(result.find((p) => p.userId === 'agent-user-1')).toBeUndefined();
    });
  });

  describe('resolvePersona', () => {
    it('resolves client', () => {
      expect(service.resolvePersona(makeOrder(), 'client-user-1')).toBe('client');
    });
    it('resolves business', () => {
      expect(service.resolvePersona(makeOrder(), 'biz-user-1')).toBe('business');
    });
    it('resolves agent', () => {
      expect(service.resolvePersona(makeOrder(), 'agent-user-1')).toBe('agent');
    });
    it('returns null for unknown user', () => {
      expect(service.resolvePersona(makeOrder(), 'unknown')).toBeNull();
    });
  });
});
