import { gql } from 'graphql-request';

// Mutation to drop/cancel order
export const DROP_ORDER = gql`
  mutation DropOrder($orderId: uuid!) {
    update_orders_by_pk(
      pk_columns: { id: $orderId }
      _set: { assigned_agent_id: null, current_status: "ready_for_pickup" }
    ) {
      id
      current_status
      assigned_agent_id
    }
  }
`;

// Mutation to update order status and payment status
export const UPDATE_ORDER_STATUS_AND_PAYMENT = gql`
  mutation UpdateOrderStatusAndPaymentStatus(
    $orderId: uuid!
    $newStatus: order_status!
    $paymentStatus: String!
  ) {
    update_orders_by_pk(
      pk_columns: { id: $orderId }
      _set: {
        current_status: $newStatus
        payment_status: $paymentStatus
        updated_at: "now()"
      }
    ) {
      id
      order_number
      current_status
      payment_status
      updated_at
    }
  }
`;

// Mutation to create status history entry
export const CREATE_STATUS_HISTORY = gql`
  mutation CreateStatusHistory(
    $orderId: uuid!
    $status: order_status!
    $notes: String!
    $changedByType: String!
    $changedByUserId: uuid!
  ) {
    insert_order_status_history(
      objects: [
        {
          order_id: $orderId
          status: $status
          notes: $notes
          changed_by_type: $changedByType
          changed_by_user_id: $changedByUserId
        }
      ]
    ) {
      affected_rows
    }
  }
`;

// Mutation to create order
export const CREATE_ORDER = gql`
  mutation CreateOrder($orderData: orders_insert_input!) {
    insert_orders_one(object: $orderData) {
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
      business_location_id
      created_at
    }
  }
`;

// Mutation to update order status
export const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($orderId: uuid!, $status: order_status!) {
    update_orders_by_pk(
      pk_columns: { id: $orderId }
      _set: { current_status: $status, updated_at: "now()" }
    ) {
      id
      order_number
      current_status
      updated_at
    }
  }
`;

// Mutation to assign order to agent
export const ASSIGN_ORDER_TO_AGENT = gql`
  mutation AssignOrderToAgent($orderId: uuid!, $agentId: uuid!) {
    update_orders_by_pk(
      pk_columns: { id: $orderId }
      _set: {
        assigned_agent_id: $agentId
        current_status: "assigned_to_agent"
        updated_at: "now()"
      }
    ) {
      id
      order_number
      current_status
      assigned_agent_id
      updated_at
    }
  }
`;

// Mutation to create order items
export const CREATE_ORDER_ITEMS = gql`
  mutation CreateOrderItems($orderItems: [order_items_insert_input!]!) {
    insert_order_items(objects: $orderItems) {
      affected_rows
      returning {
        id
        order_id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        weight_unit
        dimensions
        special_instructions
      }
    }
  }
`;

// Mutation to create order hold
export const CREATE_ORDER_HOLD = gql`
  mutation CreateOrderHold($orderHoldData: order_holds_insert_input!) {
    insert_order_holds_one(object: $orderHoldData) {
      id
      order_id
      client_id
      agent_id
      client_hold_amount
      agent_hold_amount
      delivery_fees
      currency
      status
      created_at
    }
  }
`;

// Mutation to update order hold
export const UPDATE_ORDER_HOLD = gql`
  mutation UpdateOrderHold($holdId: uuid!, $holdData: order_holds_set_input!) {
    update_order_holds_by_pk(pk_columns: { id: $holdId }, _set: $holdData) {
      id
      status
      client_hold_amount
      agent_hold_amount
      delivery_fees
      updated_at
    }
  }
`;
