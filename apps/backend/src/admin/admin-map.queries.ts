export const ADMIN_MAP_AGENTS_QUERY = `
  query AdminMapAgents {
    agents(order_by: { created_at: desc }) {
      id
      status
      is_available
      user {
        first_name
        last_name
        email
        phone_number
      }
      agent_locations(order_by: { updated_at: desc }, limit: 1) {
        latitude
        longitude
        updated_at
      }
      agent_addresses(where: { address: { status: { _eq: active } } }) {
        address {
          address_line_1
          address_line_2
          city
          state
          country
          is_primary
          latitude
          longitude
        }
      }
    }
  }
`;

export const ADMIN_MAP_LOCATIONS_QUERY = `
  query AdminMapLocations {
    business_locations {
      id
      name
      phone
      email
      is_active
      business { name }
      address {
        address_line_1
        address_line_2
        city
        state
        country
        latitude
        longitude
      }
    }
  }
`;

export const ADMIN_MAP_SEARCH_AGENTS_QUERY = `
  query AdminMapSearchAgents($where: agents_bool_exp!) {
    agents(where: $where, limit: 8) {
      id
      status
      is_available
      user { first_name last_name email phone_number }
      agent_locations(order_by: { updated_at: desc }, limit: 1) {
        latitude
        longitude
        updated_at
      }
      agent_addresses(where: { address: { status: { _eq: active } } }) {
        address {
          address_line_1
          address_line_2
          city
          state
          country
          is_primary
          latitude
          longitude
        }
      }
    }
  }
`;

export const ADMIN_MAP_SEARCH_LOCATIONS_QUERY = `
  query AdminMapSearchLocations($where: business_locations_bool_exp!) {
    business_locations(where: $where, limit: 8) {
      id
      name
      phone
      email
      is_active
      business { name }
      address {
        address_line_1
        address_line_2
        city
        state
        country
        latitude
        longitude
      }
    }
  }
`;

export const ADMIN_MAP_SEARCH_ORDERS_QUERY = `
  query AdminMapSearchOrders($where: orders_bool_exp!, $limit: Int!) {
    orders(where: $where, order_by: { created_at: desc }, limit: $limit) {
      id
      order_number
      current_status
      fulfillment_method
      business_location {
        id
        name
        phone
        email
        is_active
        business { name }
        address {
          address_line_1
          address_line_2
          city
          state
          country
          latitude
          longitude
        }
      }
      assigned_agent {
        id
        status
        is_available
        user { first_name last_name email phone_number }
        agent_locations(order_by: { updated_at: desc }, limit: 1) {
          latitude
          longitude
          updated_at
        }
        agent_addresses(where: { address: { status: { _eq: active } } }) {
          address {
            address_line_1
            address_line_2
            city
            state
            country
            is_primary
            latitude
            longitude
          }
        }
      }
    }
  }
`;

export const ADMIN_MAP_REGIONS_QUERY = `
  query AdminMapRegions($code: bpchar!) {
    supported_country_states(
      where: { country_code: { _eq: $code } }
      order_by: { state_name: asc }
    ) {
      state_name
      country_name
      country_code
    }
  }
`;
