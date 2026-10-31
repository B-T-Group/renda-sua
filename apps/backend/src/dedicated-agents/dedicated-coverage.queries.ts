/** #594 PR 2 read queries (system role). Batched: one per concern, never per agent. */

export const DEDICATED_LOCATION_CONTEXT_QUERY = `
  query DedicatedLocationContext($locationId: uuid!) {
    business_locations_by_pk(id: $locationId) {
      id
      address {
        country
        state
      }
      pickup_slots {
        slot_key
        is_enabled
      }
    }
  }
`;

export const DEDICATED_DELIVERY_SLOTS_QUERY = `
  query DedicatedDeliverySlots($country: bpchar!, $states: [String!]!) {
    delivery_time_slots(
      where: {
        country_code: { _eq: $country }
        state: { _in: $states }
        slot_type: { _eq: "standard" }
        is_active: { _eq: true }
      }
      order_by: { display_order: asc }
    ) {
      id
      state
      slot_name
      slot_type
      start_time
      end_time
    }
  }
`;

export const DEDICATED_SLOT_ASSIGNMENTS_QUERY = `
  query DedicatedSlotAssignments($locationId: uuid!, $slotKey: String!) {
    dedicated_agent_assignments(
      where: {
        business_location_id: { _eq: $locationId }
        slot_key: { _eq: $slotKey }
        status: { _eq: "active" }
      }
      order_by: { created_at: asc }
    ) {
      id
      agent_id
      status
      off_today_date
      agent {
        id
        user_id
        is_verified
        is_internal
        status
        focus
        pref_morning
        pref_afternoon
        pref_evening
      }
    }
  }
`;

export const DEDICATED_AGENT_LOAD_QUERY = `
  query DedicatedAgentLoad(
    $agentIds: [uuid!]!
    $activeStatuses: [order_status!]!
    $now: timestamptz!
  ) {
    orders(
      where: {
        assigned_agent_id: { _in: $agentIds }
        current_status: { _in: $activeStatuses }
      }
    ) {
      id
      assigned_agent_id
    }
    order_offers(
      where: {
        agent_id: { _in: $agentIds }
        offer_kind: { _eq: "dedicated" }
        status: { _eq: offered }
        expires_at: { _gt: $now }
      }
    ) {
      order_id
      agent_id
    }
  }
`;

export const DEDICATED_AGENT_BALANCES_QUERY = `
  query DedicatedAgentBalances($userIds: [uuid!]!, $currency: currency_enum!) {
    accounts(
      where: {
        user_id: { _in: $userIds }
        currency: { _eq: $currency }
        business_location_id: { _is_null: true }
        is_active: { _eq: true }
      }
      order_by: { created_at: asc }
    ) {
      user_id
      available_balance
    }
  }
`;
