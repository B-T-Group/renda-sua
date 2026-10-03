/**
 * GraphQL documents for platform-wide performance (orders, sales, payouts, stores).
 *
 * Country filters are baked into the document because GraphQL rejects
 * declared-but-unused variables. Currency comparisons are variables so each
 * aliased aggregate stays valid GraphQL.
 */

const COMPLETED_STATUSES =
  '["delivered", "complete", "refund_rejected"]';

const REFUND_STATUSES = `[
  "refund_requested", "refund_approved_full", "refund_approved_partial",
  "refund_approved_replace", "refund_processing", "refund_failed", "refunded"
]`;

function declaredVars(
  hasCountry: boolean,
  currencies: string[],
  currencyType?: string
): string {
  const parts = ['$from: timestamptz!', '$to: timestamptz!'];
  if (hasCountry) parts.push('$country: String!');
  if (currencyType) {
    currencies.forEach((code) => parts.push(`$cur_${code}: ${currencyType}!`));
  }
  return parts.join(', ');
}

/** Orders in the window, optionally limited to a store country. */
function orderWindow(hasCountry: boolean, extra = ''): string {
  const country = hasCountry
    ? 'business_location: { address: { country: { _eq: $country } } }'
    : '';
  return `created_at: { _gte: $from, _lte: $to } ${country} ${extra}`;
}

function payoutCountry(hasCountry: boolean): string {
  if (!hasCountry) return '';
  return `order: { business_location: { address: { country: { _eq: $country } } } }`;
}

function businessCountry(hasCountry: boolean): string {
  if (!hasCountry) return '';
  return `business: { business_addresses: { address: { country: { _eq: $country }, status: { _eq: active } } } }`;
}

function countSelection(where: string): string {
  return `orders_aggregate(where: { ${where} }) { aggregate { count } }`;
}

export function buildOrderCurrenciesQuery(hasCountry: boolean): string {
  return `
    query AdminPlatformOrderCurrencies(${declaredVars(hasCountry, [])}) {
      orders(
        distinct_on: currency
        where: { ${orderWindow(hasCountry)} }
        order_by: { currency: asc }
        limit: 20
      ) { currency }
    }
  `;
}

export function buildOrderMetricsQuery(
  hasCountry: boolean,
  currencies: string[]
): string {
  const money = currencies.map((code) => orderMoneyAliases(hasCountry, code));
  return `
    query AdminPlatformOrderMetrics(${declaredVars(hasCountry, currencies, 'String')}) {
      total: ${countSelection(orderWindow(hasCountry))}
      completed: ${countSelection(orderWindow(hasCountry, `current_status: { _in: ${COMPLETED_STATUSES} }`))}
      cancelled: ${countSelection(orderWindow(hasCountry, 'current_status: { _eq: cancelled }'))}
      failed: ${countSelection(orderWindow(hasCountry, 'current_status: { _eq: failed }'))}
      refunds: ${countSelection(orderWindow(hasCountry, `current_status: { _in: ${REFUND_STATUSES} }`))}
      pendingPayment: ${countSelection(orderWindow(hasCountry, 'current_status: { _eq: pending_payment }'))}
      uniqueClients: orders_aggregate(where: { ${orderWindow(hasCountry)} }) {
        aggregate { count(columns: client_id, distinct: true) }
      }
      delivery: ${countSelection(orderWindow(hasCountry, 'fulfillment_method: { _eq: delivery }'))}
      pickup: ${countSelection(orderWindow(hasCountry, 'fulfillment_method: { _eq: pickup }'))}
      shipping: ${countSelection(orderWindow(hasCountry, 'fulfillment_method: { _eq: shipping }'))}
      ${money.join('\n')}
    }
  `;
}

function orderMoneyAliases(hasCountry: boolean, code: string): string {
  const currency = `currency: { _eq: $cur_${code} }`;
  const completed = `current_status: { _in: ${COMPLETED_STATUSES} }`;
  const paid = 'payment_status: { _eq: "paid" }';
  return `
    gmv_${code}: orders_aggregate(where: { ${orderWindow(hasCountry, `${currency} ${completed}`)} }) {
      aggregate { count sum { total_amount } }
    }
    collected_${code}: orders_aggregate(where: { ${orderWindow(hasCountry, `${currency} ${paid}`)} }) {
      aggregate { sum { total_amount } }
    }
  `;
}

export function buildPayoutCurrenciesQuery(hasCountry: boolean): string {
  const compCountry = hasCountry ? 'country_code: { _eq: $country }' : '';
  return `
    query AdminPlatformPayoutCurrencies(${declaredVars(hasCountry, [])}) {
      commission_payouts(
        distinct_on: currency
        where: { created_at: { _gte: $from, _lte: $to } ${payoutCountry(hasCountry)} }
        order_by: { currency: asc }
        limit: 20
      ) { currency }
      representative_compensation_events(
        distinct_on: currency
        where: {
          created_at: { _gte: $from, _lte: $to }
          status: { _eq: "credited" }
          ${compCountry}
        }
        order_by: { currency: asc }
        limit: 20
      ) { currency }
      business_referral_payouts(
        distinct_on: currency
        where: { created_at: { _gte: $from, _lte: $to } ${businessCountry(hasCountry)} }
        order_by: { currency: asc }
        limit: 20
      ) { currency }
    }
  `;
}

export function buildPayoutAggregatesQuery(
  hasCountry: boolean,
  currencies: string[]
): string {
  const blocks = currencies.map((code) => payoutAliases(hasCountry, code));
  return `
    query AdminPlatformPayoutAggregates(${declaredVars(hasCountry, currencies, 'currency_enum')}) {
      ${blocks.join('\n')}
    }
  `;
}

function payoutAliases(hasCountry: boolean, code: string): string {
  const window = `created_at: { _gte: $from, _lte: $to } currency: { _eq: $cur_${code} }`;
  const orderCountry = payoutCountry(hasCountry);
  const sum = (alias: string, where: string) => `
    ${alias}_${code}: commission_payouts_aggregate(where: { ${window} ${orderCountry} ${where} }) {
      aggregate { sum { amount } }
    }`;
  const compCountry = hasCountry ? 'country_code: { _eq: $country }' : '';
  return `
    ${sum('platform', 'recipient_type: { _eq: "rendasua" } commission_type: { _neq: "platform_funded_delivery" }')}
    ${sum('subsidy', 'commission_type: { _eq: "platform_funded_delivery" }')}
    ${sum('agent', 'recipient_type: { _eq: "agent" }')}
    ${sum('partner', 'recipient_type: { _eq: "partner" }')}
    ${sum('merchant', 'recipient_type: { _eq: "business" }')}
    comp_${code}: representative_compensation_events_aggregate(where: {
      ${window} status: { _eq: "credited" } ${compCountry}
    }) { aggregate { sum { amount } } }
    bonus_${code}: business_referral_payouts_aggregate(where: {
      ${window} ${businessCountry(hasCountry)}
    }) { aggregate { sum { amount } } }
  `;
}

export function buildTopStoresQuery(hasCountry: boolean): string {
  const vars = `${declaredVars(hasCountry, [])}, $limit: Int!, $offset: Int!`;
  const window = orderWindow(hasCountry);
  const completed = orderWindow(
    hasCountry,
    `current_status: { _in: ${COMPLETED_STATUSES} }`
  );
  return `
    query AdminPlatformTopStores(${vars}) {
      business_locations(
        where: { orders: { ${window} } }
        order_by: { id: asc }
        limit: $limit
        offset: $offset
      ) {
        id
        name
        business {
          id
          name
          referring_agent {
            agent_code
            user { first_name last_name }
          }
          referring_business { name business_code }
        }
        orders_aggregate(where: { ${window} }) { aggregate { count } }
        completed: orders_aggregate(where: { ${completed} }) {
          aggregate { count sum { total_amount } }
        }
        orders(where: { ${window} }, limit: 1, order_by: { created_at: desc }) {
          currency
        }
      }
    }
  `;
}
