import { gql } from 'graphql-request';

// Sample query to test codegen
export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      first_name
      last_name
      email
      user_type_id
      created_at
      updated_at
    }
  }
`;

export const GET_ORDERS = gql`
  query GetOrders($limit: Int, $offset: Int) {
    orders(limit: $limit, offset: $offset) {
      id
      order_number
      total_amount
      created_at
      client {
        id
      }
    }
  }
`;
