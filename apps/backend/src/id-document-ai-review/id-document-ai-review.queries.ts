export const PENDING_ID_UPLOADS_FOR_AI_REVIEW = `
  query PendingIdUploadsForAiReview(
    $documentTypeNames: [String!]!
    $createdAfter: timestamptz!
    $limit: Int!
  ) {
    user_uploads(
      where: {
        is_approved: { _eq: false }
        created_at: { _gte: $createdAfter }
        document_type: { name: { _in: $documentTypeNames } }
        _or: [
          { note: { _is_null: true } }
          { note: { _eq: "" } }
        ]
        _not: {
          id_document_ai_reviews: {
            status: { _in: [completed, running] }
          }
        }
      }
      order_by: { created_at: asc }
      limit: $limit
    ) {
      id
      user_id
      key
      content_type
      file_name
      created_at
      document_type { name }
      user {
        id
        first_name
        last_name
        business { id name }
        agent { id }
      }
      id_document_ai_reviews(order_by: { created_at: desc }) {
        id
        status
        decision
        created_at
      }
    }
  }
`;

export const INSERT_ID_DOCUMENT_AI_REVIEW_RUNNING = `
  mutation InsertIdDocumentAiReviewRunning(
    $uploadId: uuid!
    $userId: uuid!
    $persona: String!
    $expectedName: String
    $promptVersion: String!
    $model: String
  ) {
    insert_id_document_ai_reviews_one(
      object: {
        upload_id: $uploadId
        user_id: $userId
        persona: $persona
        status: running
        expected_name: $expectedName
        prompt_version: $promptVersion
        model: $model
      }
    ) {
      id
    }
  }
`;

export const INSERT_ID_DOCUMENT_AI_REVIEW_FAILED = `
  mutation InsertIdDocumentAiReviewFailed(
    $uploadId: uuid!
    $userId: uuid!
    $persona: String!
    $expectedName: String
    $promptVersion: String!
    $error: String!
    $completedAt: timestamptz!
  ) {
    insert_id_document_ai_reviews_one(
      object: {
        upload_id: $uploadId
        user_id: $userId
        persona: $persona
        status: failed
        expected_name: $expectedName
        prompt_version: $promptVersion
        error: $error
        completed_at: $completedAt
      }
    ) {
      id
    }
  }
`;

export const COMPLETE_ID_DOCUMENT_AI_REVIEW = `
  mutation CompleteIdDocumentAiReview(
    $id: uuid!
    $status: id_document_ai_review_status!
    $decision: id_document_ai_decision
    $extractedName: String
    $confidence: numeric
    $reasons: jsonb
    $error: String
    $completedAt: timestamptz!
  ) {
    update_id_document_ai_reviews_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        decision: $decision
        extracted_name: $extractedName
        confidence: $confidence
        reasons: $reasons
        error: $error
        completed_at: $completedAt
      }
    ) {
      id
      status
      decision
    }
  }
`;

export const FAIL_STALE_RUNNING_ID_REVIEWS = `
  mutation FailStaleRunningIdReviews(
    $staleBefore: timestamptz!
    $error: String!
    $completedAt: timestamptz!
  ) {
    update_id_document_ai_reviews(
      where: {
        status: { _eq: running }
        created_at: { _lt: $staleBefore }
      }
      _set: {
        status: failed
        error: $error
        completed_at: $completedAt
      }
    ) {
      affected_rows
    }
  }
`;

export const LATEST_SIGNER_LEGAL_NAME = `
  query LatestSignerLegalName($businessId: uuid!) {
    business_merchant_agreement_acceptances(
      where: { business_id: { _eq: $businessId } }
      order_by: { accepted_at: desc }
      limit: 1
    ) {
      signer_legal_name
    }
  }
`;
