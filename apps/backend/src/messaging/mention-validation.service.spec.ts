import { HttpException } from '@nestjs/common';
import { MentionValidationService } from './mention-validation.service';
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

describe('MentionValidationService', () => {
  let service: MentionValidationService;

  beforeEach(() => {
    const participantsService = new OrderParticipantsService();
    service = new MentionValidationService(participantsService);
  });

  it('passes when a client mentions the assigned agent', () => {
    expect(() =>
      service.validateMention(makeOrder(), 'client-user-1', 'client', 'agent-user-1')
    ).not.toThrow();
  });

  it('passes when a client mentions the business', () => {
    expect(() =>
      service.validateMention(makeOrder(), 'client-user-1', 'client', 'biz-user-1')
    ).not.toThrow();
  });

  it('passes when a business mentions the client', () => {
    expect(() =>
      service.validateMention(makeOrder(), 'biz-user-1', 'business', 'client-user-1')
    ).not.toThrow();
  });

  it('passes when an agent mentions the client', () => {
    expect(() =>
      service.validateMention(makeOrder(), 'agent-user-1', 'agent', 'client-user-1')
    ).not.toThrow();
  });

  it('throws 400 when self-mention', () => {
    expect(() =>
      service.validateMention(makeOrder(), 'client-user-1', 'client', 'client-user-1')
    ).toThrow(HttpException);
  });

  it('throws 400 when mentioned user is not a participant', () => {
    expect(() =>
      service.validateMention(makeOrder(), 'client-user-1', 'client', 'stranger-user')
    ).toThrow(HttpException);
  });

  it('throws 400 when persona is not in the allowed set (client cannot mention client)', () => {
    const order = makeOrder({
      client: { user_id: 'client-user-1' },
      business: { user_id: 'other-client' },
    });
    expect(() =>
      service.validateMention(order, 'client-user-1', 'client', 'other-client')
    ).not.toThrow(); // business is allowed
  });

  it('throws 400 when agent persona is mentioned but no agent is assigned', () => {
    const order = makeOrder({
      assigned_agent_id: null,
      assigned_agent: null,
    });
    expect(() =>
      service.validateMention(order, 'client-user-1', 'client', 'agent-user-1')
    ).toThrow(HttpException);
  });
});
