import { gql } from 'graphql-request';

// Query for listing orders with filters
export const GET_ORDERS = gql`
  query GetBusinessOrders($filters: orders_bool_exp) {
    orders(where: $filters, order_by: { created_at: desc }) {
      id
      order_number
      client_id
      business_id
      business_location_id
      assigned_agent_id
      delivery_address_id
      subtotal
      delivery_fee
      tax_amount
      total_amount
      currency
      current_status
      estimated_delivery_time
      actual_delivery_time
      special_instructions
      preferred_delivery_time
      payment_method
      payment_status
      created_at
      updated_at
      client {
        id
        user {
          id
          first_name
          last_name
          email
        }
      }
      business_location {
        id
        name
        location_type
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
        }
      }
      delivery_address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      assigned_agent {
        id
        user {
          id
          first_name
          last_name
          email
        }
      }
      order_items {
        id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        item {
          sku
          currency
          model
          color
          weight
          weight_unit
          brand {
            id
            name
          }
          item_sub_category {
            id
            name
            item_category {
              id
              name
            }
          }
          item_images {
            id
            image_url
          }
        }
        weight_unit
        dimensions
        special_instructions
      }
      order_status_history {
        changed_by_type
        changed_by_user {
          agent {
            user {
              email
              first_name
              last_name
            }
          }
          business {
            user {
              email
              first_name
              last_name
            }
          }
          client {
            user {
              first_name
              email
              last_name
            }
          }
        }
        changed_by_user_id
        created_at
        id
        previous_status
        status
        notes
      }
    }
  }
`;

// Query for fetching single order by ID
export const GET_ORDER_BY_ID = gql`
  query GetOrderById($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      order_number
      client_id
      business_id
      business_location_id
      assigned_agent_id
      delivery_address_id
      subtotal
      delivery_fee
      tax_amount
      total_amount
      currency
      current_status
      estimated_delivery_time
      actual_delivery_time
      special_instructions
      preferred_delivery_time
      payment_method
      payment_status
      verified_agent_delivery
      created_at
      updated_at
      client {
        id
        user_id
        user {
          id
          identifier
          first_name
          last_name
          email
          phone_number
        }
      }
      business {
        id
        user_id
        name
        is_admin
        user {
          id
          identifier
          first_name
          last_name
          email
          phone_number
        }
      }
      business_location {
        id
        name
        location_type
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          latitude
          longitude
        }
      }
      delivery_address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        latitude
        longitude
      }
      assigned_agent {
        id
        user_id
        is_verified
        user {
          id
          identifier
          first_name
          last_name
          email
          phone_number
        }
      }
      order_items {
        id
        business_inventory_id
        item_id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        weight_unit
        dimensions
        special_instructions
        item {
          id
          sku
          name
          description
          currency
          model
          color
          weight
          weight_unit
          brand {
            id
            name
            description
          }
          item_sub_category {
            id
            name
            description
            item_category {
              id
              name
              description
            }
          }
          item_images {
            id
            image_url
            alt_text
            display_order
          }
        }
      }
      order_status_history {
        id
        order_id
        status
        previous_status
        notes
        changed_by_type
        changed_by_user_id
        created_at
        changed_by_user {
          id
          identifier
          first_name
          last_name
          email
          agent {
            id
            user {
              first_name
              last_name
              email
            }
          }
          business {
            id
            name
            user {
              first_name
              last_name
              email
            }
          }
          client {
            id
            user {
              first_name
              last_name
              email
            }
          }
        }
      }
      order_holds {
        id
        client_id
        agent_id
        client_hold_amount
        agent_hold_amount
        delivery_fees
        currency
        status
        created_at
        updated_at
      }
    }
  }
`;

// Query for fetching order by order number
export const GET_ORDER_BY_NUMBER = gql`
  query GetOrderByNumber($orderNumber: String!) {
    orders(where: { order_number: { _eq: $orderNumber } }, limit: 1) {
      id
      order_number
      current_status
      subtotal
      delivery_fee
      fast_delivery_fee
      tax_amount
      total_amount
      currency
      estimated_delivery_time
      special_instructions
      business_id
      client_id
      delivery_address_id
      requires_fast_delivery
      client {
        user_id
        user {
          id
          first_name
          last_name
          email
        }
      }
      business_location {
        id
        address_id
        business {
          id
          name
          is_verified
          user {
            id
            email
          }
        }
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
        }
      }
      delivery_address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      order_items {
        id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        weight_unit
        dimensions
        special_instructions
        item {
          id
          sku
          name
          description
          currency
          model
          color
          weight
          weight_unit
          brand {
            id
            name
          }
          item_sub_category {
            id
            name
            item_category {
              id
              name
            }
          }
          item_images {
            id
            image_url
          }
        }
      }
    }
  }
`;

// Query for basic order details
export const GET_ORDER_DETAILS = gql`
  query GetOrder($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      order_number
      current_status
      total_amount
      currency
      business_id
      client_id
      delivery_address_id
      client {
        user_id
      }
      business {
        user_id
      }
      business_location {
        address_id
      }
      assigned_agent_id
      assigned_agent {
        user_id
      }
    }
  }
`;

// Query for order with item details
export const GET_ORDER_WITH_ITEMS = gql`
  query GetOrderWithItems($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      order_number
      current_status
      subtotal
      delivery_fee
      tax_amount
      total_amount
      currency
      business_id
      client_id
      delivery_address_id
      client {
        user_id
        user {
          id
          first_name
          last_name
          email
        }
      }
      business_location {
        id
        address_id
        business {
          id
          name
          user {
            id
            email
          }
        }
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
        }
      }
      delivery_address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      order_items {
        id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        weight_unit
        dimensions
        special_instructions
        item {
          id
          sku
          name
          description
          currency
          model
          color
          weight
          weight_unit
          brand {
            id
            name
          }
          item_sub_category {
            id
            name
            item_category {
              id
              name
            }
          }
          item_images {
            id
            image_url
          }
        }
      }
    }
  }
`;

// Query for open orders (for agents)
export const GET_OPEN_ORDERS = gql`
  query OpenOrders {
    orders(
      where: {
        current_status: { _eq: "ready_for_pickup" }
        assigned_agent_id: { _is_null: true }
      }
    ) {
      id
      order_number
      business {
        name
      }
      client {
        user {
          id
          first_name
          last_name
          phone_number
          email
        }
      }
      business_location {
        id
        name
        address {
          address_line_1
          city
          state
          country
          postal_code
        }
      }
      delivery_address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      order_items {
        id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        weight_unit
        dimensions
        special_instructions
        item {
          sku
          currency
          model
          color
          weight
          weight_unit
          brand {
            id
            name
          }
          item_sub_category {
            id
            name
            item_category {
              id
              name
            }
          }
          item_images {
            id
            image_url
          }
        }
      }
      subtotal
      delivery_fee
      tax_amount
      total_amount
      currency
      estimated_delivery_time
      special_instructions
      created_at
    }
  }
`;
