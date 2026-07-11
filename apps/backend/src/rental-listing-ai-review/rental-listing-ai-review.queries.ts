export const LISTING_FOR_AI_REVIEW = `
  query ListingForAiReview($id: uuid!) {
    rental_location_listings_by_pk(id: $id) {
      id
      moderation_status
      ai_review_version
      deleted_at
      rental_item {
        id
        name
        description
        business_id
        business {
          user_id
          name
        }
        rental_item_images(order_by: { display_order: asc }) {
          id
          image_url
          display_order
          validation_errors
          quality_score
        }
      }
    }
  }
`;

export const INSERT_AI_REVIEW_RUNNING = `
  mutation InsertAiReviewRunning(
    $listingId: uuid!
    $reviewVersion: Int!
    $promptVersion: String!
    $inputSnapshot: jsonb
  ) {
    insert_rental_listing_ai_reviews_one(
      object: {
        listing_id: $listingId
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
    $status: rental_listing_ai_review_status!
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
    update_rental_listing_ai_reviews_by_pk(
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
  mutation InsertProposedImages($objects: [rental_listing_ai_proposed_images_insert_input!]!) {
    insert_rental_listing_ai_proposed_images(objects: $objects) {
      affected_rows
    }
  }
`;

export const SET_LISTING_AI_REVIEWING = `
  mutation SetListingAiReviewing($id: uuid!) {
    update_rental_location_listings(
      where: {
        id: { _eq: $id }
        moderation_status: { _in: [pending, rejected, proposal_pending] }
      }
      _set: { moderation_status: ai_reviewing }
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

export const APPLY_LISTING_MODERATION = `
  mutation ApplyListingModeration(
    $id: uuid!
    $status: rental_listing_moderation_status!
    $moderatedAt: timestamptz!
    $moderatorId: uuid
    $source: String!
    $aiReviewedAt: timestamptz
  ) {
    update_rental_location_listings_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: $status
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
export const APPLY_LISTING_MODERATION_IF_AI_REVIEWING = `
  mutation ApplyListingModerationIfAiReviewing(
    $id: uuid!
    $status: rental_listing_moderation_status!
    $moderatedAt: timestamptz!
    $source: String!
    $aiReviewedAt: timestamptz
  ) {
    update_rental_location_listings(
      where: {
        id: { _eq: $id }
        moderation_status: { _eq: ai_reviewing }
      }
      _set: {
        moderation_status: $status
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

export const RESET_LISTING_PENDING = `
  mutation ResetListingPending($id: uuid!) {
    update_rental_location_listings_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: pending
        moderated_at: null
        moderated_by_user_id: null
        moderation_source: null
      }
    ) {
      id
    }
  }
`;

/** Only reset when still claimed by AI — never unpublish finalized listings. */
export const RESET_LISTING_PENDING_IF_AI_REVIEWING = `
  mutation ResetListingPendingIfAiReviewing($id: uuid!) {
    update_rental_location_listings(
      where: {
        id: { _eq: $id }
        moderation_status: { _eq: ai_reviewing }
      }
      _set: {
        moderation_status: pending
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

export const UPDATE_RENTAL_ITEM_COPY = `
  mutation UpdateRentalItemCopy($id: uuid!, $_set: rental_items_set_input!) {
    update_rental_items_by_pk(pk_columns: { id: $id }, _set: $_set) {
      id
    }
  }
`;

export const INSERT_RENTAL_ITEM_IMAGE = `
  mutation InsertRentalItemImage($object: rental_item_images_insert_input!) {
    insert_rental_item_images_one(object: $object) {
      id
      image_url
    }
  }
`;

export const GET_AI_PROPOSAL_FOR_LISTING = `
  query GetAiProposalForListing($listingId: uuid!) {
    rental_location_listings_by_pk(id: $listingId) {
      id
      moderation_status
      rental_item {
        id
        name
        description
        business_id
        business { user_id name }
        rental_item_images(order_by: { display_order: asc }) {
          id
          image_url
          display_order
        }
      }
    }
    rental_listing_ai_reviews(
      where: { listing_id: { _eq: $listingId }, status: { _eq: proposal } }
      order_by: { created_at: desc }
      limit: 1
    ) {
      id
      listing_id
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

export const LATEST_AI_REVIEW_FOR_LISTING = `
  query LatestAiReviewForListing($listingId: uuid!) {
    rental_listing_ai_reviews(
      where: { listing_id: { _eq: $listingId } }
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
    $where: rental_listing_ai_reviews_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    rental_listing_ai_reviews(
      where: $where
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      listing_id
      status
      decision_reason
      alignment_score
      prompt_version
      admin_feedback
      admin_override_action
      model_meta
      created_at
      completed_at
      listing {
        id
        moderation_status
        rental_item {
          id
          name
          description
          business { name user_id }
        }
      }
    }
    rental_listing_ai_reviews_aggregate(where: $where) {
      aggregate { count }
    }
  }
`;

export const AI_REVIEW_BY_PK = `
  query AiReviewByPk($id: uuid!) {
    rental_listing_ai_reviews_by_pk(id: $id) {
      id
      listing_id
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
      listing {
        id
        moderation_status
        rental_item {
          id
          name
          description
          business { name user_id }
          rental_item_images(order_by: { display_order: asc }) {
            id
            image_url
            display_order
          }
        }
      }
    }
  }
`;

export const SET_AI_REVIEW_FEEDBACK = `
  mutation SetAiReviewFeedback(
    $id: uuid!
    $feedback: rental_listing_ai_admin_feedback!
    $notes: String
    $userId: uuid!
    $at: timestamptz!
  ) {
    update_rental_listing_ai_reviews_by_pk(
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
    $action: rental_listing_ai_override_action!
  ) {
    update_rental_listing_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: { admin_override_action: $action }
    ) {
      id
    }
  }
`;

export const INSERT_OWNER_MESSAGE = `
  mutation InsertRentalListingOwnerMessage(
    $userId: uuid!
    $listingId: uuid!
    $message: String!
  ) {
    insert_user_messages_one(
      object: {
        user_id: $userId
        entity_type: rental_listing
        entity_id: $listingId
        message: $message
      }
    ) {
      id
    }
  }
`;
