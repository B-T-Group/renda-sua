export const ITEM_FOR_AI_REVIEW = `
  query ItemForAiReview($id: uuid!) {
    items_by_pk(id: $id) {
      id
      name
      description
      price
      currency
      business_id
      moderation_status
      ai_review_version
      is_active
      business {
        user_id
        name
      }
      item_images(order_by: { display_order: asc }) {
        id
        image_url
        display_order
        validation_errors
        quality_score
      }
    }
  }
`;

export const GET_ITEM_MODERATION_STATUS = `
  query GetItemModerationStatus($id: uuid!) {
    items_by_pk(id: $id) {
      id
      moderation_status
    }
  }
`;

export const INSERT_AI_REVIEW_RUNNING = `
  mutation InsertAiReviewRunning(
    $itemId: uuid!
    $reviewVersion: Int!
    $promptVersion: String!
    $inputSnapshot: jsonb
  ) {
    insert_item_ai_reviews_one(
      object: {
        item_id: $itemId
        status: running
        review_version: $reviewVersion
        prompt_version: $promptVersion
        input_snapshot: $inputSnapshot
      }
    ) {
      id
    }
  }
`;

export const COMPLETE_AI_REVIEW = `
  mutation CompleteAiReview(
    $id: uuid!
    $status: item_ai_review_status!
    $decisionReason: String
    $alignmentScore: numeric
    $rubric: jsonb
    $rawModelResponse: jsonb
    $proposedTitle: String
    $proposedDescription: String
    $rejectionFields: [String!]
    $modelMeta: jsonb
    $completedAt: timestamptz!
  ) {
    update_item_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        decision_reason: $decisionReason
        alignment_score: $alignmentScore
        rubric: $rubric
        raw_model_response: $rawModelResponse
        proposed_title: $proposedTitle
        proposed_description: $proposedDescription
        rejection_fields: $rejectionFields
        model_meta: $modelMeta
        completed_at: $completedAt
      }
    ) {
      id
    }
  }
`;

export const INSERT_PROPOSED_IMAGES = `
  mutation InsertProposedImages($objects: [item_ai_proposed_images_insert_input!]!) {
    insert_item_ai_proposed_images(objects: $objects) {
      affected_rows
    }
  }
`;

export const SET_ITEM_AI_REVIEWING = `
  mutation SetItemAiReviewing($id: uuid!) {
    update_items(
      where: {
        id: { _eq: $id }
        moderation_status: { _in: [pending, rejected, proposal_pending] }
      }
      _set: { moderation_status: ai_reviewing, is_active: false }
      _inc: { ai_review_version: 1 }
    ) {
      returning {
        id
        ai_review_version
        moderation_status
      }
    }
  }
`;

export const APPLY_ITEM_MODERATION = `
  mutation ApplyItemModeration(
    $id: uuid!
    $status: item_moderation_status!
    $isActive: Boolean!
    $moderatedAt: timestamptz!
    $moderatorId: uuid
    $source: String!
    $aiReviewedAt: timestamptz
  ) {
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: $status
        is_active: $isActive
        moderated_at: $moderatedAt
        moderated_by_user_id: $moderatorId
        moderation_source: $source
        ai_reviewed_at: $aiReviewedAt
      }
    ) {
      id
    }
  }
`;

/** AI worker only: never overwrite admin/business decisions mid-flight. */
export const APPLY_ITEM_MODERATION_IF_AI_REVIEWING = `
  mutation ApplyItemModerationIfAiReviewing(
    $id: uuid!
    $status: item_moderation_status!
    $isActive: Boolean!
    $moderatedAt: timestamptz!
    $source: String!
    $aiReviewedAt: timestamptz
  ) {
    update_items(
      where: {
        id: { _eq: $id }
        moderation_status: { _eq: ai_reviewing }
      }
      _set: {
        moderation_status: $status
        is_active: $isActive
        moderated_at: $moderatedAt
        moderated_by_user_id: null
        moderation_source: $source
        ai_reviewed_at: $aiReviewedAt
      }
    ) {
      affected_rows
      returning { id }
    }
  }
`;

export const RESET_ITEM_PENDING = `
  mutation ResetItemPending($id: uuid!) {
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: pending
        is_active: false
        moderated_at: null
        moderated_by_user_id: null
        moderation_source: null
      }
    ) {
      id
    }
  }
`;

/** Only reset when still claimed by AI — never unpublish finalized items. */
export const RESET_ITEM_PENDING_IF_AI_REVIEWING = `
  mutation ResetItemPendingIfAiReviewing($id: uuid!) {
    update_items(
      where: {
        id: { _eq: $id }
        moderation_status: { _eq: ai_reviewing }
      }
      _set: {
        moderation_status: pending
        is_active: false
        moderated_at: null
        moderated_by_user_id: null
        moderation_source: null
      }
    ) {
      affected_rows
      returning { id }
    }
  }
`;

export const UPDATE_ITEM_COPY = `
  mutation UpdateItemCopy($id: uuid!, $_set: items_set_input!) {
    update_items_by_pk(pk_columns: { id: $id }, _set: $_set) {
      id
    }
  }
`;

export const INSERT_ITEM_IMAGE = `
  mutation InsertItemImage($object: item_images_insert_input!) {
    insert_item_images_one(object: $object) {
      id
      image_url
    }
  }
`;

export const GET_AI_PROPOSAL_FOR_ITEM = `
  query GetAiProposalForItem($itemId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      name
      description
      price
      currency
      business_id
      moderation_status
      is_active
      business { user_id name }
      item_images(order_by: { display_order: asc }) {
        id
        image_url
        display_order
      }
    }
    item_ai_reviews(
      where: { item_id: { _eq: $itemId }, status: { _eq: proposal } }
      order_by: { created_at: desc }
      limit: 1
    ) {
      id
      item_id
      status
      decision_reason
      proposed_title
      proposed_description
      rejection_fields
      rubric
      created_at
      completed_at
      proposed_images(order_by: { display_order: asc }) {
        id
        source_image_id
        image_url
        s3_key
        display_order
      }
    }
  }
`;

export const LATEST_AI_REVIEW_FOR_ITEM = `
  query LatestAiReviewForItem($itemId: uuid!) {
    item_ai_reviews(
      where: { item_id: { _eq: $itemId } }
      order_by: { created_at: desc }
      limit: 1
    ) {
      id
      status
      decision_reason
      proposed_title
      proposed_description
      rejection_fields
      completed_at
      created_at
    }
  }
`;

export const AI_REVIEWS_ADMIN_LIST = `
  query AiReviewsAdminList(
    $where: item_ai_reviews_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    item_ai_reviews(
      where: $where
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      item_id
      status
      decision_reason
      alignment_score
      prompt_version
      admin_feedback
      admin_override_action
      model_meta
      created_at
      completed_at
      item {
        id
        name
        description
        moderation_status
        business { id name user_id }
      }
    }
    item_ai_reviews_aggregate(where: $where) {
      aggregate { count }
    }
  }
`;

export const AI_REVIEW_BY_PK = `
  query AiReviewByPk($id: uuid!) {
    item_ai_reviews_by_pk(id: $id) {
      id
      item_id
      status
      decision_reason
      alignment_score
      rubric
      input_snapshot
      raw_model_response
      proposed_title
      proposed_description
      rejection_fields
      model_meta
      prompt_version
      review_version
      admin_feedback
      admin_feedback_notes
      admin_feedback_by_user_id
      admin_feedback_at
      admin_override_action
      created_at
      completed_at
      proposed_images(order_by: { display_order: asc }) {
        id
        source_image_id
        image_url
        s3_key
        display_order
      }
      item {
        id
        name
        description
        moderation_status
        business { id name user_id }
        item_images(order_by: { display_order: asc }) {
          id
          image_url
          display_order
        }
      }
    }
  }
`;

export const SET_AI_REVIEW_FEEDBACK = `
  mutation SetAiReviewFeedback(
    $id: uuid!
    $feedback: item_ai_admin_feedback!
    $notes: String
    $userId: uuid!
    $at: timestamptz!
  ) {
    update_item_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: {
        admin_feedback: $feedback
        admin_feedback_notes: $notes
        admin_feedback_by_user_id: $userId
        admin_feedback_at: $at
      }
    ) {
      id
    }
  }
`;

export const SET_AI_REVIEW_OVERRIDE = `
  mutation SetAiReviewOverride(
    $id: uuid!
    $action: item_ai_override_action!
  ) {
    update_item_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: { admin_override_action: $action }
    ) {
      id
    }
  }
`;

export const INSERT_OWNER_MESSAGE = `
  mutation InsertSaleItemOwnerMessage(
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
