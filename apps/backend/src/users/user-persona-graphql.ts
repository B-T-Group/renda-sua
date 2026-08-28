/**
 * Hasura exposes singular object relations on `users` (`agent`, `business`).
 * There is no array field `agents` or `businesses` on type `users`.
 */
export const USERS_AGENT_BUSINESS_SELECTION = `
            agent { id }
            business { id }
`;

export const CREDITS_SUMMARY_QUERY = `
  query CreditsSummary($where: user_credits_bool_exp!) {
    user_credits(where: $where, order_by: { created_at: desc }, limit: 5000) {
      user_id event_type weight
      user {
        first_name last_name email
        ${USERS_AGENT_BUSINESS_SELECTION}
      }
    }
  }
`;

export const CLIENT_BUYER_PERSONAS_QUERY = `
  query ClientBuyerPersonas($id: uuid!) {
    clients_by_pk(id: $id) {
      user_id
      user {
        ${USERS_AGENT_BUSINESS_SELECTION}
      }
    }
  }
`;
