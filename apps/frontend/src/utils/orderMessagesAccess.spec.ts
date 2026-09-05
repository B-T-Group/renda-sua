import {
  canSeeOrderMessages,
  resolveDelegateMessagesRedirect,
} from './orderMessagesAccess';

describe('canSeeOrderMessages', () => {
  it('lets clients and businesses open any order thread', () => {
    expect(
      canSeeOrderMessages({
        persona: 'client',
        agentId: undefined,
        assignedAgentId: 'other-agent',
      })
    ).toBe(true);
    expect(
      canSeeOrderMessages({
        persona: 'business',
        agentId: 'agent-1',
        assignedAgentId: 'other-agent',
      })
    ).toBe(true);
  });

  it('lets an assigned agent open the thread', () => {
    expect(
      canSeeOrderMessages({
        persona: 'agent',
        agentId: 'agent-1',
        assignedAgentId: 'agent-1',
      })
    ).toBe(true);
  });

  it('blocks agents without a profile or the wrong assignment', () => {
    expect(
      canSeeOrderMessages({
        persona: 'agent',
        agentId: undefined,
        assignedAgentId: 'agent-1',
      })
    ).toBe(false);
    expect(
      canSeeOrderMessages({
        persona: 'agent',
        agentId: 'agent-1',
        assignedAgentId: 'agent-2',
      })
    ).toBe(false);
    expect(
      canSeeOrderMessages({
        persona: 'agent',
        agentId: 'agent-1',
        assignedAgentId: null,
      })
    ).toBe(false);
  });
});

describe('resolveDelegateMessagesRedirect', () => {
  it('moves owner-path delegates onto the delegate messages URL', () => {
    expect(
      resolveDelegateMessagesRedirect({
        isDelegationContext: true,
        ordersApiPrefix: '/orders',
        orderId: 'ord-1',
        search: '?highlight=m1',
      })
    ).toBe('/delegate/orders/ord-1/messages?highlight=m1');
  });

  it('does not redirect when already on the delegate API or not delegating', () => {
    expect(
      resolveDelegateMessagesRedirect({
        isDelegationContext: true,
        ordersApiPrefix: '/delegate',
        orderId: 'ord-1',
        search: '?highlight=m1',
      })
    ).toBeNull();
    expect(
      resolveDelegateMessagesRedirect({
        isDelegationContext: false,
        ordersApiPrefix: '/orders',
        orderId: 'ord-1',
      })
    ).toBeNull();
    expect(
      resolveDelegateMessagesRedirect({
        isDelegationContext: true,
        ordersApiPrefix: '/orders',
        orderId: undefined,
      })
    ).toBeNull();
  });
});
