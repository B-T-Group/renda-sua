/** #594 PR 8 super-user views (AC-S1, S3, S4, S5). System role; geo where is built by GeoScopeService. */

export const ADMIN_VIEW_LIMIT = 500;
/**
 * QA #619 N2: the assign picker is one unpaged list (internal agents first, then
 * oldest), with a hold lookup per independent. It is capped well below the page
 * size and reports `truncated`; paging / name search is a follow-up if a market
 * ever has more candidates than this.
 */
export const PICKER_AGENT_LIMIT = 200;

export const DEDICATED_ADMIN_ASSIGNMENTS_QUERY = `
  query DedicatedAdminAssignments($where: dedicated_agent_assignments_bool_exp!, $limit: Int!, $offset: Int!) {
    dedicated_agent_assignments(where: $where, order_by: [{ created_at: desc }, { id: asc }], limit: $limit, offset: $offset) {
      id
      business_location_id
      agent_id
      slot_key
      status
      source
      off_today_date
      created_at
      relation_dismissed_at
      agent {
        id
        is_internal
        is_verified
        referred_by_business_id
        mobile_payment_phone {
          phone_e164
        }
        user {
          first_name
          last_name
          phone_number
          profile_picture_url
        }
      }
      business_location {
        id
        name
        phone
        order_alert_phone
        business_id
        mobile_payment_phone {
          phone_e164
        }
        address {
          city
          state
          country
        }
        business {
          id
          name
          referred_by_agent_id
          user {
            phone_number
          }
        }
        location_delegations(where: { status: { _eq: "active" } }) {
          user {
            phone_number
          }
        }
      }
    }
  }
`;

export const DEDICATED_ADMIN_ASSIGNMENT_BY_ID_QUERY = `
  query DedicatedAdminAssignmentById($id: uuid!) {
    dedicated_agent_assignments_by_pk(id: $id) {
      id
      relation_dismissed_at
      business_location {
        business_id
        address {
          country
        }
      }
    }
  }
`;

export const DISMISS_DEDICATED_RELATION_MUTATION = `
  mutation DismissDedicatedRelation($id: uuid!, $by: uuid!, $at: timestamptz!) {
    update_dedicated_agent_assignments(
      where: { id: { _eq: $id }, relation_dismissed_at: { _is_null: true } }
      _set: { relation_dismissed_at: $at, relation_dismissed_by_user_id: $by }
    ) {
      affected_rows
    }
  }
`;

export const DEDICATED_ADMIN_POSTINGS_QUERY = `
  query DedicatedAdminPostings($where: dedicated_agent_postings_bool_exp!, $limit: Int!, $offset: Int!) {
    dedicated_agent_postings(where: $where, order_by: [{ created_at: desc }, { id: asc }], limit: $limit, offset: $offset) {
      id
      business_location_id
      headcount
      accepted_count
      status
      expires_at
      created_at
      closed_at
      terms
      slots(order_by: { slot_key: asc }) {
        slot_key
      }
      pending: applications_aggregate(where: { status: { _eq: "applied" } }) {
        aggregate {
          count
        }
      }
      business_location {
        id
        name
        business_id
        address {
          city
          state
          country
        }
        business {
          name
        }
      }
    }
  }
`;

export const DEDICATED_ADMIN_POSTING_SCOPE_QUERY = `
  query DedicatedAdminPostingScope($id: uuid!) {
    dedicated_agent_postings_by_pk(id: $id) {
      id
      business_location_id
      business_location {
        business_id
      }
    }
  }
`;

/** AC-S4: locations in scope with their slot switches, live assignments and recent order sources. */
export const DEDICATED_ADMIN_COVERAGE_QUERY = `
  query DedicatedAdminCoverage(
    $where: business_locations_bool_exp!
    $limit: Int!
    $offset: Int!
    $since: timestamptz!
  ) {
    business_locations(where: $where, order_by: [{ name: asc }, { id: asc }], limit: $limit, offset: $offset) {
      id
      name
      business_id
      address {
        city
        state
        country
      }
      pickup_slots {
        slot_key
        is_enabled
      }
      dedicated_agent_assignments(where: { status: { _eq: "active" } }) {
        slot_key
        agent_id
      }
      # QA #619 N9: two counts per location, not one row per assigned order.
      dedicatedOrders: orders_aggregate(
        where: {
          created_at: { _gte: $since }
          assigned_agent_id: { _is_null: false }
          assignment_source: { _in: ["dedicated_offer", "dedicated_auto"] }
        }
      ) {
        aggregate { count }
      }
      assignedOrders: orders_aggregate(where: { created_at: { _gte: $since }, assigned_agent_id: { _is_null: false } }) {
        aggregate { count }
      }
    }
  }
`;

/** AC-S2 picker: verified agents (internal and independent), not suspended, contracted when required, in the location's country. */
export const DEDICATED_PICKER_AGENTS_QUERY = `
  query DedicatedPickerAgents($where: agents_bool_exp!, $limit: Int!) {
    agents(where: $where, order_by: [{ is_internal: desc }, { created_at: asc }], limit: $limit) {
      id
      user_id
      is_internal
      is_verified
      status
      focus
      user {
        first_name
        last_name
        profile_picture_url
      }
      live: dedicated_agent_assignments_aggregate(where: { status: { _in: ["active", "paused"] } }) {
        aggregate {
          count
        }
      }
    }
  }
`;

/** #594 G10: admin location search cap (one page; flag + city filters run in Nest). */
export const LOCATION_SEARCH_FETCH_LIMIT = 500;

export const DEDICATED_ADMIN_LOCATION_SEARCH_QUERY = `
  query DedicatedAdminLocationSearch($where: business_locations_bool_exp!, $limit: Int!) {
    business_locations(where: $where, order_by: [{ name: asc }, { id: asc }], limit: $limit) {
      id
      name
      business_id
      business {
        name
      }
      address {
        address_line_1
        city
        state
        country
      }
      pickup_slots {
        slot_key
        is_enabled
      }
      dedicated_agent_assignments(where: { status: { _in: ["active", "paused"] } }) {
        id
      }
    }
  }
`;
