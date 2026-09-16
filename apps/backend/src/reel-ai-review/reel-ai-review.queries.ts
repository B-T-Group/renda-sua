export const REEL_AI_REVIEWS_ADMIN_LIST = `
  query ReelAiReviewsAdminList(
    $where: reel_ai_reviews_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    reel_ai_reviews(
      where: $where
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      reel_id
      status
      decision_reason
      prompt_version
      admin_feedback
      admin_override_action
      model_meta
      created_at
      completed_at
      reel {
        id
        caption
        thumbnail_url
        video_url
        moderation_status
        subject_type
        subject_id
        market_country
        business { id name user_id }
      }
    }
    reel_ai_reviews_aggregate(where: $where) {
      aggregate { count }
    }
  }
`;

export const REEL_AI_REVIEW_BY_PK = `
  query ReelAiReviewByPk($id: uuid!) {
    reel_ai_reviews_by_pk(id: $id) {
      id
      reel_id
      status
      decision_reason
      input_snapshot
      raw_model_response
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
      reel {
        id
        caption
        thumbnail_url
        video_url
        moderation_status
        processing_status
        subject_type
        subject_id
        market_country
        business { id name user_id }
      }
    }
  }
`;

export const SET_REEL_AI_REVIEW_FEEDBACK = `
  mutation SetReelAiReviewFeedback(
    $id: uuid!
    $feedback: reel_ai_admin_feedback!
    $notes: String
    $userId: uuid!
    $at: timestamptz!
  ) {
    update_reel_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: {
        admin_feedback: $feedback
        admin_feedback_notes: $notes
        admin_feedback_by_user_id: $userId
        admin_feedback_at: $at
      }
    ) { id }
  }
`;

export const SET_REEL_AI_REVIEW_OVERRIDE = `
  mutation SetReelAiReviewOverride(
    $id: uuid!
    $action: reel_ai_override_action!
  ) {
    update_reel_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: { admin_override_action: $action }
    ) { id }
  }
`;
