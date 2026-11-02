export const ITEM_SNAPSHOT_FOR_REJECTION = `
  query ItemSnapshotForRejection($id: uuid!) {
    items_by_pk(id: $id) {
      id name description price currency condition wear_note is_used
      item_sub_category_id brand_id model color sku
      item_images(order_by: { display_order: asc }) { id image_url display_order }
    }
  }
`;

/** One transaction: rejection row, item pointer (+category), audit row. */
export const RECORD_ITEM_REJECTION = `
  mutation RecordItemRejection(
    $rejection: item_rejections_insert_input!
    $itemId: uuid!
    $rejectionId: uuid!
    $category: item_rejection_category!
    $audit: item_moderation_audit_insert_input!
  ) {
    insert_item_rejections_one(object: $rejection) { id created_at }
    update_items_by_pk(
      pk_columns: { id: $itemId }
      _set: { current_rejection_id: $rejectionId, rejection_category: $category }
    ) { id }
    insert_item_moderation_audit_one(object: $audit) { id }
  }
`;

export const INSERT_AUDIT = `
  mutation InsertItemModerationAudit($object: item_moderation_audit_insert_input!) {
    insert_item_moderation_audit_one(object: $object) { id }
  }
`;

export const ITEM_RECOVERY_STATE = `
  query ItemRecoveryState($id: uuid!) {
    items_by_pk(id: $id) {
      id name business_id status moderation_status rejection_category
      current_rejection_id condition wear_note is_used updated_at
      business { id user_id name }
      item_images(order_by: { display_order: asc }) {
        id image_url display_order created_at updated_at
      }
      current_rejection {
        id category reason reviewer_id source created_at
      }
      appeals(order_by: { created_at: desc }) {
        id rejection_id reason evidence_urls status admin_note outcome_moderation_status
        corrected_category withdrawn_reason decided_at sla_due_at created_at
      }
    }
    ai_image_cleanup_jobs_aggregate(where: { item_id: { _eq: $id } }) {
      aggregate { sum { tokens_consumed } }
    }
  }
`;

export const BUSINESS_TOKEN_BALANCE = `
  query BusinessTokenBalance($id: uuid!) {
    businesses_by_pk(id: $id) { id ai_tokens }
  }
`;

export const APPEAL_CONFIG = `
  query ItemAppealConfig($keys: [String!]!) {
    application_configurations(
      where: { config_key: { _in: $keys }, country_code: { _is_null: true }, status: { _eq: "active" } }
    ) { config_key number_value }
  }
`;

export const WITHDRAW_APPEAL = `
  mutation WithdrawItemAppeal($id: uuid!, $itemId: uuid!) {
    update_item_appeals(
      where: { id: { _eq: $id }, item_id: { _eq: $itemId }, status: { _eq: pending } }
      _set: { status: withdrawn, withdrawn_reason: "business" }
    ) { affected_rows }
  }
`;

export const INSERT_APPEAL = `
  mutation InsertItemAppeal(
    $object: item_appeals_insert_input!
    $audit: item_moderation_audit_insert_input!
  ) {
    insert_item_appeals_one(object: $object) {
      id rejection_id item_id business_id reason evidence_urls status sla_due_at created_at
    }
    insert_item_moderation_audit_one(object: $audit) { id }
  }
`;

export const SET_ITEM_CONDITION = `
  mutation SetItemCondition($id: uuid!, $condition: item_condition!, $wearNote: String) {
    update_items_by_pk(pk_columns: { id: $id }, _set: { condition: $condition, wear_note: $wearNote }) {
      id condition wear_note is_used
    }
  }
`;

export const APPEALS_QUEUE = `
  query ItemAppealsQueue(
    $where: item_appeals_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    item_appeals(where: $where, order_by: [{ sla_due_at: asc }, { created_at: asc }], limit: $limit, offset: $offset) {
      id item_id business_id reason evidence_urls status sla_due_at created_at
      item { id name moderation_status item_images(order_by: { display_order: asc }, limit: 1) { image_url } }
      business { id name }
      rejection { id category reason reviewer_id source created_at }
    }
    item_appeals_aggregate(where: $where) { aggregate { count } }
  }
`;

export const APPEALS_COUNTS = `
  query ItemAppealsCounts($now: timestamptz!) {
    pending: item_appeals_aggregate(where: { status: { _eq: pending } }) { aggregate { count } }
    breached: item_appeals_aggregate(where: { status: { _eq: pending }, sla_due_at: { _lte: $now } }) {
      aggregate { count }
    }
  }
`;

export const APPEAL_DETAIL = `
  query ItemAppealDetail($id: uuid!) {
    item_appeals_by_pk(id: $id) {
      id rejection_id item_id business_id submitted_by_user_id reason evidence_urls status admin_id
      admin_note outcome_moderation_status corrected_category withdrawn_reason decided_at sla_due_at created_at
      rejection {
        id category reason reviewer_id source item_snapshot created_at
        reviewer { id first_name last_name email }
      }
      business { id name user_id }
      item {
        id name description price currency condition wear_note is_used status moderation_status
        rejection_category current_rejection_id updated_at
        item_images(order_by: { display_order: asc }) { id image_url display_order created_at updated_at }
      }
    }
  }
`;

export const ITEM_HISTORY = `
  query ItemModerationHistory($itemId: uuid!) {
    item_moderation_audit(where: { item_id: { _eq: $itemId } }, order_by: { created_at: desc }, limit: 100) {
      id action details actor_user_id rejection_id appeal_id created_at
    }
    item_rejections(where: { item_id: { _eq: $itemId } }, order_by: { created_at: desc }) {
      id category reason reviewer_id source created_at
    }
  }
`;

/**
 * Overturn. Item update runs first and only matches while the appeal is still
 * pending; the appeal update then flips it. Both in one Hasura transaction, so a
 * concurrent decide leaves both at 0 affected rows.
 */
export const OVERTURN_APPEAL = `
  mutation OverturnItemAppeal(
    $appealId: uuid!
    $itemId: uuid!
    $itemSet: items_set_input!
    $appealSet: item_appeals_set_input!
  ) {
    # Order matters (one transaction, sequential): decide the appeal first so the
    # items_withdraw_pending_appeals trigger finds nothing pending when the item flips.
    appeal: update_item_appeals(
      where: {
        id: { _eq: $appealId }
        status: { _eq: pending }
        item: { id: { _eq: $itemId }, moderation_status: { _eq: rejected } }
      }
      _set: $appealSet
    ) { affected_rows }
    item: update_items(
      where: {
        id: { _eq: $itemId }
        moderation_status: { _eq: rejected }
        appeals: { id: { _eq: $appealId }, status: { _eq: overturned } }
      }
      _set: $itemSet
    ) { affected_rows }
  }
`;

export const UPHOLD_APPEAL = `
  mutation UpholdItemAppeal($appealId: uuid!, $appealSet: item_appeals_set_input!) {
    update_item_appeals(where: { id: { _eq: $appealId }, status: { _eq: pending } }, _set: $appealSet) {
      affected_rows
    }
  }
`;

export const CORRECT_CATEGORY = `
  mutation CorrectItemRejectionCategory(
    $itemId: uuid!
    $rejectionId: uuid!
    $category: item_rejection_category!
  ) {
    update_item_rejections_by_pk(pk_columns: { id: $rejectionId }, _set: { category: $category }) { id }
    update_items(
      where: { id: { _eq: $itemId }, moderation_status: { _eq: rejected }, current_rejection_id: { _eq: $rejectionId } }
      _set: { rejection_category: $category }
    ) { affected_rows }
  }
`;

/** Self-review rule: other users holding a role that is superuser or grants item moderation. */
export const OTHER_ITEM_MODERATORS = `
  query OtherItemModerators($userId: uuid!, $permissionKey: String!, $superuser: String!) {
    user_roles(
      where: {
        user_id: { _neq: $userId }
        role: {
          _or: [
            { key: { _eq: $superuser } }
            { role_permissions: { permission: { key: { _eq: $permissionKey } } } }
          ]
        }
      }
      limit: 1
    ) { user_id }
    user_permissions(
      where: { user_id: { _neq: $userId }, effect: { _eq: allow }, permission: { key: { _eq: $permissionKey } } }
      limit: 1
    ) { user_id }
  }
`;

export const USER_FOR_NOTICE = `
  query ItemAppealNoticeUser($id: uuid!) {
    users_by_pk(id: $id) { id preferred_language }
  }
`;
