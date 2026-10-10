import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { firstImage } from './assistant-cards';
import type {
  AssistantCard,
  AssistantIdentity,
  AssistantToolResult,
} from './assistant.types';

const AGENT_TOOLS = new Set([
  'get_my_active_deliveries',
  'get_my_earnings_summary',
  'get_my_agent_status',
]);

type DeliveryRow = {
  id: string;
  order_number: string;
  current_status: string;
  business?: { name?: string | null } | null;
  order_items?: Array<{
    item_name?: string | null;
    item?: { item_images?: Array<{ image_url?: string | null; display_url?: string | null }> } | null;
  }>;
};

export class AssistantAgentToolsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  handles(name: string): boolean {
    return AGENT_TOOLS.has(name);
  }

  tools(identity: AssistantIdentity): Tool[] {
    if (identity.accountType !== 'agent' || !identity.agentId) return [];
    return [
      simpleTool('get_my_active_deliveries', 'Orders currently assigned to this agent. No customer phone numbers.'),
      simpleTool('get_my_earnings_summary', 'Completed delivery count for this agent. Balance is on get_my_wallet.'),
      simpleTool('get_my_agent_status', 'Verification, availability, and a count of open delivery work in the agent market.'),
    ];
  }

  run(name: string, identity: AssistantIdentity): Promise<AssistantToolResult> {
    if (identity.accountType !== 'agent' || !identity.agentId || !identity.userId) {
      return Promise.resolve({ content: 'No agent profile is linked to this account.' });
    }
    if (name === 'get_my_active_deliveries') return this.deliveries(identity.agentId);
    if (name === 'get_my_earnings_summary') return this.earnings(identity.agentId);
    if (name === 'get_my_agent_status') return this.status(identity);
    return Promise.resolve({ content: `Unknown tool: ${name}`, handoff: true });
  }

  private async deliveries(agentId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ orders: DeliveryRow[] }>(
      DELIVERIES_QUERY,
      { agentId }
    );
    const orders = result.orders || [];
    return { content: JSON.stringify(orders.map(deliverySummary)), cards: orders.map(deliveryCard) };
  }

  private async earnings(agentId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{
      orders_aggregate: { aggregate: { count: number } | null };
    }>(EARNINGS_QUERY, { agentId });
    const completed = result.orders_aggregate?.aggregate?.count ?? 0;
    return {
      content: `Completed deliveries: ${completed}. Wallet balance is available from get_my_wallet. Do not explain withdrawals.`,
    };
  }

  private async status(identity: AssistantIdentity): Promise<AssistantToolResult> {
    const agent = await this.hasura.executeQuery<{
      agents_by_pk: { is_verified: boolean; is_available: boolean } | null;
    }>(AGENT_QUERY, { agentId: identity.agentId });
    const open = await this.openWorkCount(identity.country);
    const row = agent.agents_by_pk;
    return {
      content: JSON.stringify({
        verified: row?.is_verified === true,
        available: row?.is_available === true,
        openDeliveriesInMarket: open,
      }),
    };
  }

  private async openWorkCount(country: string | null): Promise<number | null> {
    if (!country) return null;
    const result = await this.hasura.executeQuery<{
      orders_aggregate: { aggregate: { count: number } | null };
    }>(OPEN_WORK_QUERY, { country });
    return result.orders_aggregate?.aggregate?.count ?? 0;
  }
}

function deliverySummary(order: DeliveryRow) {
  return {
    orderNumber: order.order_number,
    status: order.current_status,
    business: order.business?.name || null,
  };
}

function deliveryCard(order: DeliveryRow): AssistantCard {
  return {
    kind: 'order',
    id: order.id,
    title: order.business?.name || order.order_number,
    imageUrl: firstImage(order.order_items?.[0]?.item?.item_images),
    priceLabel: order.current_status,
    href: `/orders/${order.id}`,
  };
}

function simpleTool(name: string, description: string): Tool {
  return {
    toolSpec: { name, description, inputSchema: { json: { type: 'object', properties: {} } } },
  };
}

const DELIVERIES_QUERY = `query AssistantAgentDeliveries($agentId: uuid!) {
  orders(
    where: {
      assigned_agent_id: { _eq: $agentId }
      current_status: { _in: ["assigned_to_agent", "picked_up", "in_transit", "out_for_delivery"] }
    }
    order_by: { created_at: desc }
    limit: 5
  ) {
    id order_number current_status
    business { name }
    order_items(limit: 1) {
      item_name
      item { item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url } }
    }
  }
}`;

const EARNINGS_QUERY = `query AssistantAgentEarnings($agentId: uuid!) {
  orders_aggregate(where: {
    assigned_agent_id: { _eq: $agentId }
    current_status: { _in: ["delivered", "complete"] }
  }) { aggregate { count } }
}`;

const AGENT_QUERY = `query AssistantAgent($agentId: uuid!) {
  agents_by_pk(id: $agentId) { is_verified is_available }
}`;

const OPEN_WORK_QUERY = `query AssistantOpenWork($country: String!) {
  orders_aggregate(where: {
    assigned_agent_id: { _is_null: true }
    current_status: { _eq: "ready_for_pickup" }
    fulfillment_country: { _eq: $country }
  }) { aggregate { count } }
}`;
