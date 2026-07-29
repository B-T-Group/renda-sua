export const BUSINESS_CUTOFF_DATE = '2026-04-01';
export const MIN_ITEM_COUNT = 10;

const QUEUE_BASE_WHERE = `
  referred_by_agent_id: { _is_null: false }
  created_at: { _gte: $cutoff }
  items_aggregate: {
    count: {
      predicate: { _gte: $minItems }
      filter: {
        status: { _eq: active }
        is_active: { _eq: true }
        moderation_status: { _eq: approved }
      }
    }
  }
  _not: { business_referral_payouts: {} }
`;

/** Exclude already-approved reviews so pending queue paginates in the DB. */
const QUEUE_PENDING_EXTRA = `
  _not: { business_referral_reviews: { status: { _eq: "approved" } } }
`;

export function buildQueueCandidatesQuery(excludeApproved: boolean): string {
  const where = excludeApproved
    ? `${QUEUE_BASE_WHERE}\n        ${QUEUE_PENDING_EXTRA}`
    : QUEUE_BASE_WHERE;
  return `
  query BusinessReferralReviewQueue(
    $cutoff: timestamptz!
    $minItems: Int!
    $limit: Int!
    $offset: Int!
  ) {
    businesses(
      where: {
        ${where}
      }
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      name
      created_at
      referred_by_agent_id
      items_aggregate(
        where: {
          status: { _eq: active }
          is_active: { _eq: true }
          moderation_status: { _eq: approved }
        }
      ) {
        aggregate { count }
      }
      business_referral_reviews {
        id
        status
        rejection_reason
        good_item_count
        bad_item_count
        reviewed_at
      }
      referring_agent {
        id
        agent_code
        user { id first_name last_name }
      }
    }
    businesses_aggregate(
      where: {
        ${where}
      }
    ) {
      aggregate { count }
    }
  }
`;
}

export const REVIEWS_BY_STATUS_QUERY = `
  query BusinessReferralReviewsByStatus(
    $status: String!
    $limit: Int!
    $offset: Int!
  ) {
    business_referral_reviews(
      where: { status: { _eq: $status } }
      order_by: { reviewed_at: desc_nulls_last }
      limit: $limit
      offset: $offset
    ) {
      id
      status
      rejection_reason
      good_item_count
      bad_item_count
      reviewed_at
      business {
        id
        name
        created_at
        items_aggregate(
          where: {
            status: { _eq: active }
            is_active: { _eq: true }
            moderation_status: { _eq: approved }
          }
        ) {
          aggregate { count }
        }
        business_referral_payouts { id }
      }
      agent {
        id
        agent_code
        user { id first_name last_name }
      }
    }
    business_referral_reviews_aggregate(where: { status: { _eq: $status } }) {
      aggregate { count }
    }
  }
`;

export const REVIEW_DETAIL_QUERY = `
  query BusinessReferralReviewDetail($businessId: uuid!) {
    businesses_by_pk(id: $businessId) {
      id
      name
      created_at
      referred_by_agent_id
      referring_agent {
        id
        agent_code
        user { id first_name last_name preferred_language }
      }
      business_referral_payouts { id }
      business_referral_reviews {
        id
        status
        rejection_reason
        good_item_count
        bad_item_count
        reviewed_at
        reviewed_by_user_id
        item_marks {
          item_id
          quality
        }
      }
      items(order_by: { created_at: asc }) {
        id
        name
        description
        price
        currency
        status
        is_active
        moderation_status
        created_at
        updated_at
        item_images(order_by: { display_order: asc }) {
          id
          image_url
          display_order
        }
        business_inventories {
          id
          quantity
          business_location {
            id
            name
          }
        }
      }
    }
  }
`;

/** Single transaction: clear prior marks, upsert review, insert new marks. */
export const SUBMIT_REVIEW_MUTATION = `
  mutation SubmitBusinessReferralReview(
    $businessId: uuid!
    $object: business_referral_reviews_insert_input!
  ) {
    delete_business_referral_review_item_marks(
      where: { review: { business_id: { _eq: $businessId } } }
    ) {
      affected_rows
    }
    insert_business_referral_reviews_one(
      object: $object
      on_conflict: {
        constraint: uq_business_referral_reviews_business_id
        update_columns: [
          agent_id
          status
          rejection_reason
          good_item_count
          bad_item_count
          reviewed_by_user_id
          reviewed_at
          updated_at
        ]
      }
    ) {
      id
      status
    }
  }
`;

export const INSERT_REJECTION_MESSAGE = `
  mutation InsertReferralReviewRejectionMessage(
    $userId: uuid!
    $reviewId: uuid!
    $message: String!
    $payload: jsonb!
  ) {
    insert_user_messages_one(
      object: {
        user_id: $userId
        entity_type: business_referral_review
        entity_id: $reviewId
        message: $message
        message_type: BUSINESS_REFERRAL_REVIEW_REJECTED
        message_payload: $payload
      }
    ) {
      id
    }
  }
`;

export const REVIEWS_FOR_BUSINESS_IDS_QUERY = `
  query ReferralReviewsForBusinessIds($ids: [uuid!]!) {
    business_referral_reviews(where: { business_id: { _in: $ids } }) {
      business_id
      status
      rejection_reason
    }
    business_referral_payouts(where: { business_id: { _in: $ids } }) {
      business_id
    }
  }
`;
