import {
  getQuickMessageTemplate,
  isTemplateEligibleForOrder,
  resolveTemplateTagPersonas,
} from './quick-message.catalog';
import type { MessagingOrder } from '../messaging.types';

function order(partial: Partial<MessagingOrder>): MessagingOrder {
  return {
    id: 'order-1',
    order_number: 'ORD-1',
    business_id: 'biz-1',
    client_id: 'client-1',
    assigned_agent_id: 'agent-1',
    current_status: 'out_for_delivery',
    fulfillment_method: 'delivery',
    client: { user_id: 'client-user' },
    business: { user_id: 'biz-user' },
    assigned_agent: { user_id: 'agent-user' },
    ...partial,
  };
}

describe('quick-message.catalog', () => {
  it('exposes agent_arrived for agents at out_for_delivery', () => {
    const template = getQuickMessageTemplate('agent_arrived');
    expect(template).toBeDefined();
    expect(
      isTemplateEligibleForOrder(template!, order({}), 'agent')
    ).toBe(true);
    expect(
      isTemplateEligibleForOrder(template!, order({}), 'client')
    ).toBe(false);
  });

  it('tags client and business for client_unreachable', () => {
    const template = getQuickMessageTemplate('client_unreachable');
    expect(resolveTemplateTagPersonas(template!, order({}))).toEqual([
      'client',
      'business',
    ]);
  });

  it('blocks delivery templates on pickup orders', () => {
    const template = getQuickMessageTemplate('agent_arrived');
    expect(
      isTemplateEligibleForOrder(
        template!,
        order({ fulfillment_method: 'pickup' }),
        'agent'
      )
    ).toBe(false);
  });

  it('resolves order_ready_for_pickup tags to agent when assigned', () => {
    const template = getQuickMessageTemplate('order_ready_for_pickup');
    expect(
      resolveTemplateTagPersonas(
        template!,
        order({ current_status: 'ready_for_pickup' })
      )
    ).toEqual(['agent']);
  });

  it('resolves order_ready_for_pickup to client for unassigned store pickup', () => {
    const template = getQuickMessageTemplate('order_ready_for_pickup');
    expect(
      resolveTemplateTagPersonas(
        template!,
        order({
          current_status: 'ready_for_pickup',
          fulfillment_method: 'pickup',
          assigned_agent_id: null,
          assigned_agent: null,
        })
      )
    ).toEqual(['client']);
  });
});
