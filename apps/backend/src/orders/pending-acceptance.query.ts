import type { PendingAcceptanceOrder } from './order-acceptance.types';

export const PENDING_ACCEPTANCE_QUEUE_LIMIT = 10;

export interface PendingAcceptanceResult {
  active: boolean;
  order: PendingAcceptanceOrder | null;
  queue: Array<{ id: string }>;
}

const ORDER_FIELDS = `
  id order_number current_status acceptance_state
  acceptance_deadline_at grace_deadline_at
  busy_extra_prep_minutes estimated_prep_minutes
  created_at total_amount currency fulfillment_method
  fulfillment_timing promised_ready_at promised_fulfill_by business_id
  pay_after_merchant_confirm is_cooked_food_pickup
  client { user { first_name last_name } }
  order_items {
    item_name
    quantity
    item {
      is_cooked_food
      item_sub_category {
        name
        item_category { name }
      }
    }
  }
`;

function pendingWhere(includeLocation: boolean): string {
  const location = includeLocation
    ? 'business_location_id: { _eq: $lid }'
    : '';
  return `{
    business_id: { _eq: $bid }
    ${location}
    current_status: { _eq: pending }
    acceptance_state: { _in: [awaiting_acceptance, no_response, grace] }
    _not: {
      _and: [
        { acceptance_state: { _eq: awaiting_acceptance } }
        { busy_extra_prep_minutes: { _gt: 0 } }
        { updated_at: { _gte: $snoozeCutoff } }
      ]
    }
  }`;
}

export function actionableAcceptanceCountQuery(): string {
  return `query ActionableAcceptanceCount($bid: uuid!, $snoozeCutoff: timestamptz!) {
    orders_aggregate(where: ${pendingWhere(false)}) {
      aggregate { count }
    }
  }`;
}

export function pendingAcceptanceQuery(includeLocation: boolean): string {
  const name = includeLocation ? 'PendingAcceptanceLoc' : 'PendingAcceptance';
  const lid = includeLocation ? '$lid: uuid!, ' : '';
  const where = pendingWhere(includeLocation);
  return `query ${name}($bid: uuid!, ${lid}$snoozeCutoff: timestamptz!) {
    orders(where: ${where}, order_by: { created_at: asc }, limit: 1) { ${ORDER_FIELDS} }
    queue: orders(
      where: ${where}
      order_by: { created_at: asc }
      limit: ${PENDING_ACCEPTANCE_QUEUE_LIMIT}
    ) { id }
  }`;
}

export function mapPendingAcceptance(res: {
  orders?: PendingAcceptanceOrder[] | null;
  queue?: Array<{ id: string }> | null;
}): PendingAcceptanceResult {
  const order = res.orders?.[0] ?? null;
  const queue = (res.queue ?? [])
    .map((row) => ({ id: row.id }))
    .filter((row) => !!row.id);
  if (!queue.length && order) queue.push({ id: order.id });
  return { active: !!order, order, queue };
}
