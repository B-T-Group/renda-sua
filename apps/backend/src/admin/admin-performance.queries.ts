/**
 * GraphQL documents for the admin performance module.
 *
 * Country filters are baked into the document (instead of a nullable
 * variable) because GraphQL rejects declared-but-unused variables.
 */

const activeAddressCountry = `address: { country: { _eq: $country }, status: { _eq: active } }`;

function businessCountryFilter(hasCountry: boolean): string {
  return hasCountry
    ? `business_addresses: { ${activeAddressCountry} }`
    : '';
}

function viaBusinessCountryFilter(hasCountry: boolean): string {
  return hasCountry
    ? `business: { business_addresses: { ${activeAddressCountry} } }`
    : '';
}

export function buildSummaryQuery(hasCountry: boolean): string {
  const countryVar = hasCountry ? ', $country: String!' : '';
  const clientFilter = hasCountry
    ? `client_addresses: { ${activeAddressCountry} }`
    : '';
  const agentFilter = hasCountry
    ? `agent_addresses: { ${activeAddressCountry} }`
    : '';
  const createdRange = `created_at: { _gte: $from, _lte: $to }`;
  return `
    query AdminPerformanceSummary($from: timestamptz!, $to: timestamptz!${countryVar}) {
      businesses_aggregate(where: { ${createdRange} ${businessCountryFilter(hasCountry)} }) {
        aggregate { count }
      }
      clients_aggregate(where: { ${createdRange} ${clientFilter} }) {
        aggregate { count }
      }
      agents_aggregate(where: { ${createdRange} ${agentFilter} }) {
        aggregate { count }
      }
      items_aggregate(where: { ${createdRange} ${viaBusinessCountryFilter(hasCountry)} }) {
        aggregate { count }
      }
      rental_items_aggregate(where: { ${createdRange} ${viaBusinessCountryFilter(hasCountry)} }) {
        aggregate { count }
      }
    }
  `;
}

export function buildDeliveryAgentsQuery(hasCountry: boolean): string {
  const countryVar = hasCountry ? ', $country: String!' : '';
  const countryFilter = hasCountry
    ? `delivery_address: { country: { _eq: $country } }`
    : '';
  const deliveredOrdersFilter = `
    current_status: { _in: ["delivered", "complete"] }
    _or: [
      { actual_delivery_time: { _gte: $from, _lte: $to } }
      {
        actual_delivery_time: { _is_null: true }
        created_at: { _gte: $from, _lte: $to }
      }
    ]
    ${countryFilter}
  `;
  return `
    query AdminPerformanceDeliveryAgents(
      $from: timestamptz!
      $to: timestamptz!
      $limit: Int!
      $offset: Int!
      ${countryVar}
    ) {
      agents(
        where: { orders: { ${deliveredOrdersFilter} } }
        order_by: { id: asc }
        limit: $limit
        offset: $offset
      ) {
        id
        agent_code
        user {
          first_name
          last_name
        }
        orders_aggregate(where: { ${deliveredOrdersFilter} }) {
          aggregate {
            count
          }
        }
      }
    }
  `;
}

export function buildReferredBusinessesQuery(hasCountry: boolean): string {
  const countryVar = hasCountry ? ', $country: String!' : '';
  return `
    query AdminPerformanceReferredBusinesses(
      $from: timestamptz!
      $to: timestamptz!
      $limit: Int!
      $offset: Int!
      ${countryVar}
    ) {
      businesses(
        where: {
          referred_by_agent_id: { _is_null: false }
          created_at: { _gte: $from, _lte: $to }
          ${businessCountryFilter(hasCountry)}
        }
        order_by: { id: asc }
        limit: $limit
        offset: $offset
      ) {
        id
        name
        created_at
        referred_by_agent_id
        items_aggregate(
          where: {
            status: { _eq: active }
            is_active: { _eq: true }
            moderation_status: { _eq: approved }
          }
        ) {
          aggregate { count }
        }
      }
    }
  `;
}

export const AGENTS_BY_IDS_QUERY = `
  query AdminPerformanceAgentsByIds($ids: [uuid!]!) {
    agents(where: { id: { _in: $ids } }) {
      id
      agent_code
      user {
        first_name
        last_name
      }
      agent_addresses(
        where: { address: { status: { _eq: active } } }
        order_by: [{ address: { is_primary: desc } }]
        limit: 1
      ) {
        address {
          country
        }
      }
    }
  }
`;

export const MARKETS_QUERY = `
  query AdminPerformanceMarkets {
    supported_country_states(
      distinct_on: country_code
      order_by: { country_code: asc }
    ) {
      country_code
      country_name
    }
  }
`;
