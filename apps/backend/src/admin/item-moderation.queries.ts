export const ITEMS_MODERATION_LIST = `
  query ItemsModeration($where: items_bool_exp!, $limit: Int!, $offset: Int!) {
    items(
      where: $where
      order_by: { created_at: asc }
      limit: $limit
      offset: $offset
    ) {
      id
      name
      description
      moderation_status
      created_at
      price
      currency
      is_active
      business {
        id
        name
        user_id
      }
      item_images(order_by: { display_order: asc }, limit: 5) {
        id
        image_url
        display_order
      }
    }
    items_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export const ITEM_FOR_MODERATION_BY_PK = `
  query ItemForModeration($id: uuid!) {
    items_by_pk(id: $id) {
      id
      name
      moderation_status
      status
      business {
        id
        user_id
      }
    }
  }
`;

export const APPROVE_ITEM_MODERATION = `
  mutation ApproveItemModeration(
    $id: uuid!
    $moderatedAt: timestamptz!
    $moderatorId: uuid!
  ) {
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: approved
        is_active: true
        moderated_at: $moderatedAt
        moderated_by_user_id: $moderatorId
        moderation_source: "admin"
      }
    ) {
      id
    }
  }
`;

export const REJECT_ITEM_MODERATION = `
  mutation RejectItemModeration(
    $id: uuid!
    $moderatedAt: timestamptz!
    $moderatorId: uuid!
  ) {
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: rejected
        is_active: false
        moderated_at: $moderatedAt
        moderated_by_user_id: $moderatorId
        moderation_source: "admin"
      }
    ) {
      id
    }
  }
`;

export const INSERT_ITEM_REJECTION_MESSAGE = `
  mutation InsertItemRejectionMessage(
    $userId: uuid!
    $itemId: uuid!
    $message: String!
  ) {
    insert_user_messages_one(
      object: {
        user_id: $userId
        entity_type: sale_item
        entity_id: $itemId
        message: $message
      }
    ) {
      id
    }
  }
`;
