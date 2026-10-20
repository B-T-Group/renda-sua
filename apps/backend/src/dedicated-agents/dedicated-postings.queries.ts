/** #594 PR 7 posting / application reads and writes (system role; Nest-only writes). */

const POSTING_FIELDS = `
  id
  business_location_id
  headcount
  accepted_count
  days_of_week
  terms
  terms_updated_at
  status
  expires_at
  filled_at
  closed_at
  closed_reason
  created_at
  slots(order_by: { slot_key: asc }) {
    slot_key
  }
`;

const POSTING_LOCATION_FIELDS = `
  business_location {
    id
    name
    business_id
    business {
      name
      user_id
      user {
        preferred_language
      }
    }
    address {
      address_line_1
      city
      state
      country
      latitude
      longitude
    }
  }
`;

export const DEDICATED_POSTING_LOCATION_QUERY = `
  query DedicatedPostingLocation($locationId: uuid!) {
    business_locations_by_pk(id: $locationId) {
      id
      name
      business_id
      business {
        name
        user_id
        user {
          preferred_language
        }
      }
      address {
        address_line_1
        city
        state
        country
        latitude
        longitude
      }
    }
  }
`;

export const DEDICATED_POSTING_BY_ID_QUERY = `
  query DedicatedPostingById($id: uuid!) {
    dedicated_agent_postings_by_pk(id: $id) {
      ${POSTING_FIELDS}
      ${POSTING_LOCATION_FIELDS}
    }
  }
`;

export const DEDICATED_LOCATION_POSTINGS_QUERY = `
  query DedicatedLocationPostings($locationId: uuid!, $limit: Int!) {
    dedicated_agent_postings(
      where: { business_location_id: { _eq: $locationId } }
      order_by: [{ created_at: desc }]
      limit: $limit
    ) {
      ${POSTING_FIELDS}
      pending: applications_aggregate(where: { status: { _eq: "applied" } }) {
        aggregate {
          count
        }
      }
    }
  }
`;

/** Open postings already holding one of these slots at the location (AC-B12). */
export const DEDICATED_OPEN_POSTING_FOR_SLOTS_QUERY = `
  query DedicatedOpenPostingForSlots($locationId: uuid!, $slotKeys: [String!]!) {
    dedicated_agent_posting_slots(
      where: { business_location_id: { _eq: $locationId }, slot_key: { _in: $slotKeys }, is_open: { _eq: true } }
      limit: 1
    ) {
      posting_id
    }
  }
`;

/** One transaction: the posting, then its slots (the open-slot unique index guards AC-B12 races). */
export const INSERT_DEDICATED_POSTING_MUTATION = `
  mutation InsertDedicatedPosting(
    $posting: dedicated_agent_postings_insert_input!
    $slots: [dedicated_agent_posting_slots_insert_input!]!
  ) {
    insert_dedicated_agent_postings_one(object: $posting) {
      id
    }
    insert_dedicated_agent_posting_slots(objects: $slots) {
      affected_rows
    }
  }
`;

export const UPDATE_DEDICATED_POSTING_TERMS_MUTATION = `
  mutation UpdateDedicatedPostingTerms($id: uuid!, $terms: String, $at: timestamptz!) {
    update_dedicated_agent_postings(
      where: { id: { _eq: $id }, status: { _eq: "open" } }
      _set: { terms: $terms, terms_updated_at: $at }
    ) {
      affected_rows
    }
  }
`;

/**
 * Close (AC-B13) in one transaction: the posting moves open -> closed, then the
 * pending applicants of that now-closed posting are auto-declined. When the
 * posting was not open any more the second update matches nothing new.
 */
export const CLOSE_DEDICATED_POSTING_MUTATION = `
  mutation CloseDedicatedPosting($id: uuid!, $by: uuid!, $at: timestamptz!, $reason: String) {
    update_dedicated_agent_postings(
      where: { id: { _eq: $id }, status: { _eq: "open" } }
      _set: { status: "closed", closed_at: $at, closed_by_user_id: $by, closed_reason: $reason }
    ) {
      affected_rows
    }
    update_dedicated_agent_applications(
      where: { posting_id: { _eq: $id }, status: { _eq: "applied" }, posting: { status: { _eq: "closed" } } }
      _set: { status: "auto_declined", decided_at: $at }
    ) {
      returning {
        id
        agent_id
      }
    }
  }
`;

/** Expiry sweep (AC-B13, 14 days): same shape as close, for every open posting past expires_at. */
export const EXPIRE_DEDICATED_POSTINGS_MUTATION = `
  mutation ExpireDedicatedPostings($ids: [uuid!]!, $now: timestamptz!) {
    update_dedicated_agent_postings(
      where: { id: { _in: $ids }, status: { _eq: "open" }, expires_at: { _lte: $now } }
      _set: { status: "expired", closed_at: $now, closed_reason: "expired" }
    ) {
      returning {
        id
      }
    }
    update_dedicated_agent_applications(
      where: { posting_id: { _in: $ids }, status: { _eq: "applied" }, posting: { status: { _eq: "expired" } } }
      _set: { status: "auto_declined", decided_at: $now }
    ) {
      returning {
        id
        agent_id
        posting_id
      }
    }
  }
`;

export const DEDICATED_EXPIRED_POSTINGS_QUERY = `
  query DedicatedExpiredPostings($now: timestamptz!, $limit: Int!) {
    dedicated_agent_postings(
      where: { status: { _eq: "open" }, expires_at: { _lte: $now } }
      order_by: [{ expires_at: asc }]
      limit: $limit
    ) {
      id
      business_location {
        address {
          country
        }
      }
    }
  }
`;

const APPLICATION_AGENT_FIELDS = `
  agent {
    id
    user_id
    created_at
    is_internal
    pickups_completed_count
    pickups_reassigned_count
    user {
      first_name
      profile_picture_url
      preferred_language
    }
    agent_addresses(where: { address: { status: { _eq: active } } }, order_by: { address: { created_at: asc } }) {
      address {
        latitude
        longitude
        is_primary
      }
    }
  }
`;

export const DEDICATED_POSTING_APPLICATIONS_QUERY = `
  query DedicatedPostingApplications($postingId: uuid!) {
    dedicated_agent_applications(
      where: { posting_id: { _eq: $postingId }, status: { _in: ["applied", "accepted"] } }
      order_by: [{ created_at: asc }]
    ) {
      id
      posting_id
      agent_id
      status
      created_at
      updated_at
      ${APPLICATION_AGENT_FIELDS}
    }
  }
`;

export const DEDICATED_APPLICATION_BY_ID_QUERY = `
  query DedicatedApplicationById($id: uuid!) {
    dedicated_agent_applications_by_pk(id: $id) {
      id
      posting_id
      agent_id
      status
      agent {
        id
        user_id
        user {
          first_name
          phone_number
          preferred_language
        }
      }
    }
  }
`;

/** Lifetime stats for applicant cards (AC-B14): any store, not only this one. */
export const DEDICATED_APPLICANT_STATS_QUERY = `
  query DedicatedApplicantStats($agentIds: [uuid!]!, $doneStatuses: [order_status!]!) {
    delivered: orders(where: { assigned_agent_id: { _in: $agentIds }, current_status: { _in: $doneStatuses } }) {
      assigned_agent_id
    }
    missed: failed_deliveries(
      where: { resolution_type: { _eq: agent_fault }, order: { assigned_agent_id: { _in: $agentIds } } }
    ) {
      order {
        assigned_agent_id
      }
    }
  }
`;

/** AC-E8: the locked accept (20261018220000). Returns the accepted row and the rows it auto-declined. */
export const ACCEPT_DEDICATED_APPLICATION_MUTATION = `
  mutation AcceptDedicatedApplication($applicationId: uuid!, $actorUserId: uuid!) {
    dedicated_accept_application(args: { p_application_id: $applicationId, p_actor_user_id: $actorUserId }) {
      id
      agent_id
      status
    }
  }
`;

export const DECLINE_DEDICATED_APPLICATION_MUTATION = `
  mutation DeclineDedicatedApplication($id: uuid!, $by: uuid!, $at: timestamptz!) {
    update_dedicated_agent_applications(
      where: { id: { _eq: $id }, status: { _eq: "applied" } }
      _set: { status: "declined", decided_by_user_id: $by, decided_at: $at }
    ) {
      affected_rows
    }
  }
`;

/** Accepted rows' assignments, for the accept response. */
export const DEDICATED_APPLICATION_ASSIGNMENTS_QUERY = `
  query DedicatedApplicationAssignments($applicationId: uuid!) {
    dedicated_agent_assignments(where: { application_id: { _eq: $applicationId } }, order_by: [{ slot_key: asc }]) {
      id
      slot_key
      status
      source
    }
  }
`;

// ------------------------------------------------------------------ agent side

export const DEDICATED_OPPORTUNITY_AGENT_QUERY = `
  query DedicatedOpportunityAgent($userId: uuid!) {
    agents(where: { user_id: { _eq: $userId } }, limit: 1) {
      id
      user_id
      is_verified
      is_internal
      status
      focus
      user {
        first_name
        profile_picture_url
        preferred_language
        country
      }
      agent_addresses(where: { address: { status: { _eq: active } } }, order_by: { address: { created_at: asc } }) {
        address {
          city
          state
          country
          latitude
          longitude
          is_primary
        }
      }
    }
  }
`;

/** Open, unexpired postings in the agent's country; city / state matching happens in Nest (normalised). */
export const DEDICATED_OPPORTUNITIES_QUERY = `
  query DedicatedOpportunities($country: String!, $now: timestamptz!, $agentId: uuid!, $limit: Int!) {
    dedicated_agent_postings(
      where: {
        status: { _eq: "open" }
        expires_at: { _gt: $now }
        business_location: { address: { country: { _ilike: $country } } }
      }
      order_by: [{ created_at: desc }]
      limit: $limit
    ) {
      ${POSTING_FIELDS}
      ${POSTING_LOCATION_FIELDS}
      mine: applications(where: { agent_id: { _eq: $agentId } }) {
        id
        status
        created_at
        updated_at
      }
    }
    held: dedicated_agent_assignments(where: { agent_id: { _eq: $agentId }, status: { _in: ["active", "paused"] } }) {
      business_location_id
      slot_key
    }
  }
`;

/** #594 G1: one posting with the agent's own application (any status) and held slots. */
export const DEDICATED_OPPORTUNITY_BY_ID_QUERY = `
  query DedicatedOpportunityById($id: uuid!, $agentId: uuid!) {
    dedicated_agent_postings_by_pk(id: $id) {
      ${POSTING_FIELDS}
      ${POSTING_LOCATION_FIELDS}
      mine: applications(where: { agent_id: { _eq: $agentId } }) {
        id
        status
        created_at
        updated_at
      }
    }
    held: dedicated_agent_assignments(where: { agent_id: { _eq: $agentId }, status: { _in: ["active", "paused"] } }) {
      business_location_id
      slot_key
    }
  }
`;

export const DEDICATED_AGENT_HELD_ASSIGNMENTS_QUERY = `
  query DedicatedAgentHeldAssignments($agentId: uuid!) {
    held: dedicated_agent_assignments(where: { agent_id: { _eq: $agentId }, status: { _in: ["active", "paused"] } }) {
      business_location_id
      slot_key
    }
    mine: dedicated_agent_applications(where: { agent_id: { _eq: $agentId } }) {
      id
      posting_id
      status
    }
  }
`;

/**
 * Apply: insert, or re-apply after a withdrawal (the on_conflict `where` only
 * revives a withdrawn row; any other existing row returns null and is read back).
 */
export const UPSERT_DEDICATED_APPLICATION_MUTATION = `
  mutation UpsertDedicatedApplication($object: dedicated_agent_applications_insert_input!) {
    insert_dedicated_agent_applications_one(
      object: $object
      on_conflict: {
        constraint: dedicated_agent_applications_posting_agent_key
        update_columns: [status, withdrawn_at]
        where: { status: { _eq: "withdrawn" } }
      }
    ) {
      id
      status
    }
  }
`;

/** An apply that landed after the posting stopped being open is auto-declined straight away. */
export const AUTO_DECLINE_LATE_APPLICATION_MUTATION = `
  mutation AutoDeclineLateApplication($id: uuid!, $at: timestamptz!) {
    update_dedicated_agent_applications(
      where: { id: { _eq: $id }, status: { _eq: "applied" }, posting: { status: { _neq: "open" } } }
      _set: { status: "auto_declined", decided_at: $at }
    ) {
      affected_rows
    }
  }
`;

export const WITHDRAW_DEDICATED_APPLICATION_MUTATION = `
  mutation WithdrawDedicatedApplication($postingId: uuid!, $agentId: uuid!, $at: timestamptz!) {
    update_dedicated_agent_applications(
      where: { posting_id: { _eq: $postingId }, agent_id: { _eq: $agentId }, status: { _eq: "applied" } }
      _set: { status: "withdrawn", withdrawn_at: $at }
    ) {
      affected_rows
    }
  }
`;

/** Agents with a pending application on a posting (terms-updated push, A1c). */
export const DEDICATED_POSTING_PENDING_AGENTS_QUERY = `
  query DedicatedPostingPendingAgents($postingId: uuid!) {
    dedicated_agent_applications(where: { posting_id: { _eq: $postingId }, status: { _eq: "applied" } }) {
      id
      agent {
        user_id
        user {
          preferred_language
        }
      }
    }
  }
`;

/** user_id / language for agents being told about an outcome. */
export const DEDICATED_AGENTS_CONTACT_QUERY = `
  query DedicatedAgentsContact($agentIds: [uuid!]!) {
    agents(where: { id: { _in: $agentIds } }) {
      id
      user_id
      user {
        preferred_language
      }
    }
  }
`;
