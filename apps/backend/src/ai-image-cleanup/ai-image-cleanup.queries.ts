export const JOB_FIELDS = `
  id
  business_id
  item_id
  item_variant_id
  requested_by_user_id
  status
  tokens_reserved
  tokens_consumed
  tokens_refunded
  mode
  source
  created_at
  updated_at
  completed_at
`;

export const RESULT_FIELDS = `
  id
  job_id
  business_image_id
  item_variant_image_id
  rental_item_image_id
  original_image_url
  original_s3_key
  cleaned_image_url
  cleaned_s3_key
  status
  error_message
  retry_of_result_id
  confidence_score
  confidence_tier
  confidence_signals
  changes
  applied_at
  reverted_at
  provider
  provider_model
  created_at
  updated_at
  completed_at
`;

export const VERSION_IMAGE_FIELDS = `
  id
  image_url
  s3_key
  original_image_url
  original_s3_key
  enhanced_image_url
  enhanced_s3_key
  active_version
  is_ai_cleaned
  enhanced_at
  reverted_at
  content_hash
  width
  height
  validation_warnings
  validation_errors
  quality_score
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
      item_variant { id name }
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
      item_variant { id name }
      results(where: { status: { _in: [ready, failed] } }, order_by: { created_at: asc }) {
        ${RESULT_FIELDS}
      }
    }
  }
`;

export const GET_RECENT_ACTIVITY = `
  query GetAiImageCleanupActivity($businessId: uuid!, $since: timestamptz!) {
    ai_image_cleanup_results(
      where: {
        job: { business_id: { _eq: $businessId } }
        applied_at: { _gte: $since }
        status: { _eq: accepted }
        reverted_at: { _is_null: true }
      }
      order_by: { applied_at: desc }
      limit: 20
    ) {
      ${RESULT_FIELDS}
      job { ${JOB_FIELDS} item { id name } item_variant { id name } }
    }
  }
`;

export const GET_OPEN_JOB_FOR_ITEM = `
  query GetOpenAiImageCleanupJob($itemId: uuid!) {
    ai_image_cleanup_jobs(
      where: {
        item_id: { _eq: $itemId }
        item_variant_id: { _is_null: true }
        status: { _in: [queued, processing, ready_for_review] }
      }
      limit: 1
    ) {
      id status
    }
  }
`;

export const GET_OPEN_JOB_FOR_VARIANT = `
  query GetOpenAiImageCleanupJobForVariant($variantId: uuid!) {
    ai_image_cleanup_jobs(
      where: {
        item_variant_id: { _eq: $variantId }
        status: { _in: [queued, processing, ready_for_review] }
      }
      limit: 1
    ) {
      id status
    }
  }
`;

export const GET_OPEN_JOB_FOR_ITEM_IMAGE = `
  query GetOpenCleanupJobForItemImage($imageId: uuid!) {
    ai_image_cleanup_results(
      where: {
        business_image_id: { _eq: $imageId }
        status: { _in: [queued, processing, ready] }
        job: { status: { _in: [queued, processing, ready_for_review] } }
      }
      limit: 1
    ) {
      id
    }
  }
`;

export const GET_OPEN_JOB_FOR_RENTAL_IMAGE = `
  query GetOpenCleanupJobForRentalImage($imageId: uuid!) {
    ai_image_cleanup_results(
      where: {
        rental_item_image_id: { _eq: $imageId }
        status: { _in: [queued, processing, ready] }
        job: { status: { _in: [queued, processing, ready_for_review] } }
      }
      limit: 1
    ) {
      id
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
      ${VERSION_IMAGE_FIELDS}
      item_id
      business_id
    }
  }
`;

export const GET_VARIANT_IMAGES = `
  query GetVariantImagesForCleanup($variantId: uuid!) {
    item_variants_by_pk(id: $variantId) {
      id
      name
      item_id
      item {
        id
        business_id
      }
    }
    item_variant_images(
      where: { item_variant_id: { _eq: $variantId } }
      order_by: [{ display_order: asc }, { created_at: asc }]
    ) {
      ${VERSION_IMAGE_FIELDS}
      item_variant_id
    }
  }
`;

export const GET_ITEM_IMAGE_BY_ID = `
  query GetItemImageForCleanup($id: uuid!) {
    item_images_by_pk(id: $id) {
      ${VERSION_IMAGE_FIELDS}
      item_id
      business_id
    }
  }
`;

export const GET_RENTAL_IMAGE_BY_ID = `
  query GetRentalImageForCleanup($id: uuid!) {
    rental_item_images_by_pk(id: $id) {
      ${VERSION_IMAGE_FIELDS}
      rental_item_id
      business_id
    }
  }
`;

export const GET_RENTAL_ITEM_IDS_FOR_IMAGES = `
  query GetRentalItemIdsForImages($ids: [uuid!]!) {
    rental_item_images(where: { id: { _in: $ids } }) {
      rental_item_id
    }
  }
`;

export const FIND_ENHANCED_BY_HASH = `
  query FindEnhancedByContentHash($businessId: uuid!, $contentHash: String!) {
    item_images(
      where: {
        business_id: { _eq: $businessId }
        content_hash: { _eq: $contentHash }
        enhanced_image_url: { _is_null: false }
        is_ai_cleaned: { _eq: true }
      }
      limit: 1
    ) {
      ${VERSION_IMAGE_FIELDS}
    }
  }
`;

export const GET_BUSINESS_AUTO_ENHANCE = `
  query GetBusinessAutoEnhance($businessId: uuid!) {
    businesses_by_pk(id: $businessId) {
      id
      auto_enhance_enabled
      ai_tokens
    }
  }
`;

export const UPDATE_BUSINESS_AUTO_ENHANCE = `
  mutation UpdateBusinessAutoEnhance($id: uuid!, $enabled: Boolean!) {
    update_businesses_by_pk(
      pk_columns: { id: $id }
      _set: { auto_enhance_enabled: $enabled }
    ) {
      id
      auto_enhance_enabled
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

export const CLAIM_JOB = `
  mutation ClaimAiImageCleanupJob(
    $id: uuid!
    $updatedAt: timestamptz!
    $staleBefore: timestamptz!
  ) {
    update_ai_image_cleanup_jobs(
      where: {
        id: { _eq: $id }
        _or: [
          { status: { _eq: queued } }
          {
            status: { _eq: processing }
            updated_at: { _lt: $staleBefore }
          }
        ]
      }
      _set: { status: processing, updated_at: $updatedAt }
    ) {
      affected_rows
    }
  }
`;

export const CLAIM_STALE_PROCESSING_JOB = `
  mutation ClaimStaleProcessingAiImageCleanupJob(
    $id: uuid!
    $updatedAt: timestamptz!
    $staleBefore: timestamptz!
  ) {
    update_ai_image_cleanup_jobs(
      where: {
        id: { _eq: $id }
        status: { _eq: processing }
        updated_at: { _lt: $staleBefore }
      }
      _set: { status: processing, updated_at: $updatedAt }
    ) {
      affected_rows
    }
  }
`;

export const CLAIM_RESULT = `
  mutation ClaimAiImageCleanupResult(
    $id: uuid!
    $updatedAt: timestamptz!
    $staleBefore: timestamptz!
  ) {
    update_ai_image_cleanup_results(
      where: {
        id: { _eq: $id }
        _or: [
          { status: { _eq: queued } }
          {
            status: { _eq: processing }
            updated_at: { _lt: $staleBefore }
          }
        ]
      }
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

export const FAIL_OPEN_RESULTS = `
  mutation FailOpenAiImageCleanupResults(
    $jobId: uuid!
    $updatedAt: timestamptz!
    $completedAt: timestamptz!
    $staleBefore: timestamptz!
    $errorMessage: String!
  ) {
    update_ai_image_cleanup_results(
      where: {
        job_id: { _eq: $jobId }
        _or: [
          { status: { _eq: queued } }
          {
            status: { _eq: processing }
            updated_at: { _lt: $staleBefore }
          }
        ]
      }
      _set: {
        status: failed
        error_message: $errorMessage
        updated_at: $updatedAt
        completed_at: $completedAt
      }
    ) {
      affected_rows
    }
  }
`;

export const REJECT_ACTIONABLE_RESULTS = `
  mutation RejectActionableAiImageCleanupResults(
    $jobId: uuid!
    $updatedAt: timestamptz!
    $completedAt: timestamptz!
  ) {
    update_ai_image_cleanup_results(
      where: {
        job_id: { _eq: $jobId }
        status: { _in: [ready, failed] }
      }
      _set: {
        status: rejected
        updated_at: $updatedAt
        completed_at: $completedAt
      }
    ) {
      affected_rows
    }
  }
`;

export const UPDATE_ITEM_IMAGE = `
  mutation ApplyCleanedItemImage($id: uuid!, $_set: item_images_set_input!) {
    update_item_images_by_pk(pk_columns: { id: $id }, _set: $_set) {
      ${VERSION_IMAGE_FIELDS}
    }
  }
`;

export const UPDATE_VARIANT_IMAGE = `
  mutation ApplyCleanedVariantImage($id: uuid!, $_set: item_variant_images_set_input!) {
    update_item_variant_images_by_pk(pk_columns: { id: $id }, _set: $_set) {
      ${VERSION_IMAGE_FIELDS}
    }
  }
`;

export const UPDATE_RENTAL_IMAGE = `
  mutation ApplyCleanedRentalImage($id: uuid!, $_set: rental_item_images_set_input!) {
    update_rental_item_images_by_pk(pk_columns: { id: $id }, _set: $_set) {
      ${VERSION_IMAGE_FIELDS}
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
        item_variant { id name }
      }
    }
  }
`;

export const GET_BUSINESS_USER = `
  query GetBusinessOwnerUser($businessId: uuid!) {
    businesses_by_pk(id: $businessId) {
      id
      user_id
      auto_enhance_enabled
      user { id preferred_language }
    }
  }
`;

export const INSERT_SITE_EVENT = `
  mutation InsertEnhancementSiteEvent($object: site_events_insert_input!) {
    insert_site_events_one(object: $object) {
      id
    }
  }
`;
