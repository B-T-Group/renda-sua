/** #594 PR 3 assignment / pickup-slot reads and writes (system role; Nest-only writes). */

export const DEDICATED_LOCATION_OWNER_QUERY = `
  query DedicatedLocationOwner($locationId: uuid!) {
    business_locations_by_pk(id: $locationId) {
      id
      business_id
      business {
        user_id
      }
    }
  }
`;

export const DEDICATED_ASSIGNMENT_LOCATION_QUERY = `
  query DedicatedAssignmentLocation($locationId: uuid!) {
    business_locations_by_pk(id: $locationId) {
      id
      name
      business_id
      business {
        id
        name
        user_id
        user {
          id
          preferred_language
        }
      }
      address {
        country
        state
      }
    }
  }
`;

export const DEDICATED_ASSIGN_AGENT_QUERY = `
  query DedicatedAssignAgent($agentId: uuid!) {
    agents_by_pk(id: $agentId) {
      id
      user_id
      is_verified
      is_internal
      status
      focus
      user {
        first_name
        last_name
        preferred_language
      }
    }
  }
`;

export const DEDICATED_AGENT_BY_USER_QUERY = `
  query DedicatedAgentByUser($userId: uuid!) {
    agents(where: { user_id: { _eq: $userId } }, limit: 1) {
      id
      user_id
    }
  }
`;

const ASSIGNMENT_FIELDS = `
  id
  business_location_id
  agent_id
  slot_key
  status
  source
  off_today_date
  paused_at
  removed_at
  created_at
  agent {
    id
    user_id
    is_internal
    is_verified
    user {
      first_name
      last_name
      profile_picture_url
      preferred_language
    }
  }
  business_location {
    id
    name
    address {
      country
      state
    }
  }
`;

export const DEDICATED_ASSIGNMENT_BY_ID_QUERY = `
  query DedicatedAssignmentById($id: uuid!) {
    dedicated_agent_assignments_by_pk(id: $id) {
      ${ASSIGNMENT_FIELDS}
    }
  }
`;

export const DEDICATED_LOCATION_LIVE_ASSIGNMENTS_QUERY = `
  query DedicatedLocationLiveAssignments($locationId: uuid!) {
    dedicated_agent_assignments(
      where: { business_location_id: { _eq: $locationId }, status: { _in: ["active", "paused"] } }
      order_by: [{ slot_key: asc }, { created_at: asc }]
    ) {
      ${ASSIGNMENT_FIELDS}
    }
  }
`;

export const DEDICATED_AGENT_LIVE_ASSIGNMENTS_QUERY = `
  query DedicatedAgentLiveAssignments($agentId: uuid!) {
    dedicated_agent_assignments(
      where: { agent_id: { _eq: $agentId }, status: { _in: ["active", "paused"] } }
      order_by: [{ created_at: asc }]
    ) {
      ${ASSIGNMENT_FIELDS}
    }
  }
`;

/** Business-side recipients besides the owner: delegates whose role grants the manage permission. */
export const DEDICATED_NOTICE_DELEGATES_QUERY = `
  query DedicatedNoticeDelegates($locationId: uuid!, $permission: String!) {
    location_delegations(
      where: {
        business_location_id: { _eq: $locationId }
        status: { _eq: "active" }
        role: { role_permissions: { permission: { key: { _eq: $permission } } } }
      }
    ) {
      user_id
      user {
        preferred_language
      }
    }
  }
`;

/**
 * Card stats for this store (QA #603 N4: counted in Postgres, not row lists):
 * per agent `d<i>` completed deliveries and `m<i>` agent-fault failures as
 * aggregates, plus the last 20 completed subtotals (typical hold).
 */
export function dedicatedCardStatsQuery(agentCount: number): string {
  const vars = Array.from({ length: agentCount }, (_, i) => `$a${i}: uuid!`).join(' ');
  const counts = Array.from(
    { length: agentCount },
    (_, i) => `
    d${i}: orders_aggregate(
      where: { business_location_id: { _eq: $locationId }, assigned_agent_id: { _eq: $a${i} }, current_status: { _in: $doneStatuses } }
    ) { aggregate { count } }
    m${i}: failed_deliveries_aggregate(
      where: { resolution_type: { _eq: agent_fault }, order: { business_location_id: { _eq: $locationId }, assigned_agent_id: { _eq: $a${i} } } }
    ) { aggregate { count } }`
  ).join('');
  return `
  query DedicatedCardStats($locationId: uuid!, $doneStatuses: [order_status!]! ${vars}) {${counts}
    recent: orders(
      where: { business_location_id: { _eq: $locationId }, current_status: { _in: $doneStatuses } }
      order_by: { created_at: desc }
      limit: 20
    ) {
      subtotal
    }
  }
`;
}

export const DEDICATED_LOCATION_PICKUP_SLOTS_QUERY = `
  query DedicatedLocationPickupSlots($locationId: uuid!) {
    business_location_pickup_slots(where: { business_location_id: { _eq: $locationId } }) {
      slot_key
      is_enabled
      pickup_time
    }
  }
`;

export const INSERT_DEDICATED_ASSIGNMENTS_MUTATION = `
  mutation InsertDedicatedAssignments($objects: [dedicated_agent_assignments_insert_input!]!) {
    insert_dedicated_agent_assignments(objects: $objects) {
      returning {
        id
        agent_id
        slot_key
        status
        source
      }
    }
  }
`;

/** Guarded single-row transition: only applies while the row is still in one of `from`. */
export const UPDATE_DEDICATED_ASSIGNMENT_MUTATION = `
  mutation UpdateDedicatedAssignment(
    $id: uuid!
    $from: [String!]!
    $set: dedicated_agent_assignments_set_input!
  ) {
    update_dedicated_agent_assignments(where: { id: { _eq: $id }, status: { _in: $from } }, _set: $set) {
      affected_rows
      returning {
        id
        status
        off_today_date
        paused_at
        removed_at
      }
    }
  }
`;

/** One transaction: upsert the slot settings, then pause (agent_id order) agents of slots turned off. */
/**
 * Saves the slot switches and, when any slot is turned off, pauses that slot's
 * active assignments by predicate in the same transaction (QA #603 N2), so an
 * assignment created after the caller's read is paused too.
 */
export function savePickupSlotsMutation(withPauses: boolean): string {
  return `
    mutation SaveDedicatedPickupSlots(
      $slots: [business_location_pickup_slots_insert_input!]!
      ${withPauses ? '$locationId: uuid!, $offSlots: [String!]!, $pauseSet: dedicated_agent_assignments_set_input!' : ''}
    ) {
      insert_business_location_pickup_slots(
        objects: $slots
        on_conflict: {
          constraint: business_location_pickup_slots_location_slot_key
          update_columns: [is_enabled, pickup_time, updated_by_user_id]
        }
      ) {
        affected_rows
      }
      ${
        withPauses
          ? `paused: update_dedicated_agent_assignments(
        where: { business_location_id: { _eq: $locationId }, slot_key: { _in: $offSlots }, status: { _eq: "active" } }
        _set: $pauseSet
      ) {
        returning { id agent_id slot_key source business_location_id }
      }`
          : ''
      }
    }
  `;
}
