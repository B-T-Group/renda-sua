export const JOB_FIELDS = `
  id
  business_id
  item_id
  requested_by_user_id
  status
  tokens_reserved
  tokens_consumed
  tokens_refunded
  created_at
  updated_at
  completed_at
`;

export const RESULT_FIELDS = `
  id
  job_id
  business_image_id
  original_image_url
  original_s3_key
  cleaned_image_url
  cleaned_s3_key
  status
  error_message
  retry_of_result_id
  created_at
  updated_at
  completed_at
`;

export const INSERT_JOB = `
  mutation InsertAiImageCleanupJob($object: ai_image_cleanup_jobs_insert_input!) {
    insert_ai_image_cleanup_jobs_one(object: $object) {
      ${JOB_FIELDS}
    }
  }
`;

export const INSERT_RESULTS = `
  mutation InsertAiImageCleanupResults($objects: [ai_image_cleanup_results_insert_input!]!) {
    insert_ai_image_cleanup_results(objects: $objects) {
      returning { ${RESULT_FIELDS} }
    }
  }
`;

export const GET_JOB_WITH_RESULTS = `
  query GetAiImageCleanupJob($id: uuid!) {
    ai_image_cleanup_jobs_by_pk(id: $id) {
      ${JOB_FIELDS}
      item { id name }
      results(order_by: { created_at: asc }) {
        ${RESULT_FIELDS}
      }
    }
  }
`;

export const GET_PENDING_JOBS = `
  query GetPendingAiImageCleanupJobs($businessId: uuid!) {
    ai_image_cleanup_jobs(
      where: {
        business_id: { _eq: $businessId }
        status: { _in: [ready_for_review, failed] }
      }
      order_by: { created_at: desc }
    ) {
      ${JOB_FIELDS}
      item { id name }
      results(where: { status: { _in: [ready, failed] } }, order_by: { created_at: asc }) {
        ${RESULT_FIELDS}
      }
    }
  }
`;

export const GET_OPEN_JOB_FOR_ITEM = `
  query GetOpenAiImageCleanupJob($itemId: uuid!) {
    ai_image_cleanup_jobs(
      where: {
        item_id: { _eq: $itemId }
        status: { _in: [queued, processing, ready_for_review] }
      }
      limit: 1
    ) {
      id status
    }
  }
`;

export const GET_ITEM_IMAGES = `
  query GetItemImagesForCleanup($itemId: uuid!, $businessId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      business_id
      name
      business { user_id }
    }
    item_images(
      where: {
        item_id: { _eq: $itemId }
        business_id: { _eq: $businessId }
      }
      order_by: [{ display_order: asc_nulls_last }, { created_at: asc }]
    ) {
      id
      image_url
      s3_key
      is_ai_cleaned
      item_id
      business_id
    }
  }
`;

export const UPDATE_JOB = `
  mutation UpdateAiImageCleanupJob($id: uuid!, $_set: ai_image_cleanup_jobs_set_input!) {
    update_ai_image_cleanup_jobs_by_pk(pk_columns: { id: $id }, _set: $_set) {
      ${JOB_FIELDS}
    }
  }
`;

/** Atomically claim a job for processing (only from queued). */
export const CLAIM_JOB = `
  mutation ClaimAiImageCleanupJob($id: uuid!, $updatedAt: timestamptz!) {
    update_ai_image_cleanup_jobs(
      where: { id: { _eq: $id }, status: { _eq: queued } }
      _set: { status: processing, updated_at: $updatedAt }
    ) {
      affected_rows
    }
  }
`;

/** Atomically claim a result for processing (only from queued). */
export const CLAIM_RESULT = `
  mutation ClaimAiImageCleanupResult($id: uuid!, $updatedAt: timestamptz!) {
    update_ai_image_cleanup_results(
      where: { id: { _eq: $id }, status: { _eq: queued } }
      _set: { status: processing, updated_at: $updatedAt }
    ) {
      affected_rows
    }
  }
`;

export const UPDATE_RESULT = `
  mutation UpdateAiImageCleanupResult($id: uuid!, $_set: ai_image_cleanup_results_set_input!) {
    update_ai_image_cleanup_results_by_pk(pk_columns: { id: $id }, _set: $_set) {
      ${RESULT_FIELDS}
    }
  }
`;

export const UPDATE_ITEM_IMAGE = `
  mutation ApplyCleanedItemImage($id: uuid!, $_set: item_images_set_input!) {
    update_item_images_by_pk(pk_columns: { id: $id }, _set: $_set) {
      id image_url s3_key is_ai_cleaned
    }
  }
`;

export const GET_RESULT = `
  query GetAiImageCleanupResult($id: uuid!) {
    ai_image_cleanup_results_by_pk(id: $id) {
      ${RESULT_FIELDS}
      job {
        ${JOB_FIELDS}
        item { id name }
      }
    }
  }
`;

export const GET_BUSINESS_USER = `
  query GetBusinessOwnerUser($businessId: uuid!) {
    businesses_by_pk(id: $businessId) {
      id
      user_id
      user { id preferred_language }
    }
  }
`;
