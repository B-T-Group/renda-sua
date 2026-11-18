export const RANK_SNAPSHOT = `
  query DeclineRankSnapshot($keys: [String!]!) {
    application_configurations(
      where: {
        config_key: { _in: $keys }
        status: { _eq: "active" }
        country_code: { _is_null: true }
      }
    ) { config_key number_value }
    rental_condition_decline_counts_90d(where: { role: { _eq: "business" } }) {
      party_id
      decline_count
    }
    rental_business_pickup_reach_90d { business_id pickups_reached }
  }
`;

export const EXCLUSION_ROWS = `
  query DeclineExclusionRows($since: timestamptz!, $limit: Int!, $offset: Int!) {
    rental_condition_declines(
      where: { created_at: { _gte: $since } }
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      reason
      reason_text
      excluded_at
      exclusion_note
      rental_booking {
        id
        booking_number
        business_id
        client_id
        business { name }
        client { user { first_name last_name } }
      }
    }
    rental_condition_decline_counts_90d { role party_id decline_count }
    rental_business_pickup_reach_90d { business_id pickups_reached }
  }
`;

export const ACTOR_ROLES = `
  query DeclineExclusionRoles($id: uuid!) {
    user_roles(where: { user_id: { _eq: $id } }) { role { key } }
  }
`;

export const DECLINE_FOR_EXCLUSION = `
  query DeclineForExclusion($bookingId: uuid!) {
    rental_condition_declines(
      where: { rental_booking_id: { _eq: $bookingId } }
      order_by: { created_at: asc }
    ) { id rental_booking { id status } }
  }
`;

export const SET_EXCLUSION = `
  mutation SetDeclineExclusion($id: uuid!, $set: rental_condition_declines_set_input!) {
    update_rental_condition_declines_by_pk(pk_columns: { id: $id }, _set: $set) { id excluded_at }
  }
`;
