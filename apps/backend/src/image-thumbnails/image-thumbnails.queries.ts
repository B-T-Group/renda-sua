import {
  THUMBNAIL_TABLES,
  THUMBNAIL_TABLES_WITH_BUSINESS_ID,
  ThumbnailSourceType,
} from './image-thumbnails.types';

function sourceFields(sourceType: ThumbnailSourceType): string {
  const businessId = THUMBNAIL_TABLES_WITH_BUSINESS_ID.includes(sourceType)
    ? 'business_id'
    : '';
  return `
  id
  ${businessId}
  image_url
  s3_key
  thumbnail
  thumbnail_status
  thumbnail_attempts
`;
}

/** Atomically claim a row (pending/failed → processing); returns the row when won. */
export function claimMutation(sourceType: ThumbnailSourceType): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    mutation ClaimThumbnail($id: uuid!, $now: timestamptz!) {
      update_${table}(
        where: {
          id: { _eq: $id },
          thumbnail_status: { _in: ["pending", "failed"] }
        },
        _set: { thumbnail_status: "processing", thumbnail_last_attempt_at: $now },
        _inc: { thumbnail_attempts: 1 }
      ) {
        affected_rows
        returning { ${sourceFields(sourceType)} }
      }
    }
  `;
}

// Terminal writes are guarded on status = processing AND the image_url the worker
// claimed, so a stale worker cannot overwrite a row that was reset/re-claimed after
// its original bytes were replaced (e.g. AI cleanup accept, image_url update).
export function markReadyMutation(sourceType: ThumbnailSourceType): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    mutation MarkThumbnailReady(
      $id: uuid!,
      $sourceImageUrl: String!,
      $thumbnail: String!,
      $s3Key: String!,
      $width: Int,
      $height: Int,
      $format: String,
      $bytes: Int,
      $now: timestamptz!
    ) {
      update_${table}(
        where: {
          id: { _eq: $id },
          thumbnail_status: { _eq: "processing" },
          image_url: { _eq: $sourceImageUrl }
        },
        _set: {
          thumbnail_status: "ready",
          thumbnail: $thumbnail,
          thumbnail_s3_key: $s3Key,
          thumbnail_width: $width,
          thumbnail_height: $height,
          thumbnail_format: $format,
          thumbnail_bytes: $bytes,
          thumbnail_generated_at: $now,
          thumbnail_error: null
        }
      ) {
        affected_rows
      }
    }
  `;
}

export function markFailedMutation(
  sourceType: ThumbnailSourceType,
  status: 'failed' | 'skipped'
): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    mutation MarkThumbnailFailed($id: uuid!, $sourceImageUrl: String!, $error: String) {
      update_${table}(
        where: {
          id: { _eq: $id },
          thumbnail_status: { _eq: "processing" },
          image_url: { _eq: $sourceImageUrl }
        },
        _set: { thumbnail_status: "${status}", thumbnail_error: $error }
      ) {
        affected_rows
      }
    }
  `;
}

/** Reset a row to pending (used by regenerate; force also clears the old thumb). */
export function resetToPendingMutation(
  sourceType: ThumbnailSourceType
): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    mutation ResetThumbnail($id: uuid!) {
      update_${table}_by_pk(
        pk_columns: { id: $id },
        _set: {
          thumbnail_status: "pending",
          thumbnail: null,
          thumbnail_s3_key: null,
          thumbnail_error: null,
          thumbnail_attempts: 0
        }
      ) {
        id
      }
    }
  `;
}

/** Page of rows needing thumbnails, keyset-paginated by created_at. */
export function backfillQuery(sourceType: ThumbnailSourceType): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    query ThumbnailBackfillPage(
      $statuses: [image_thumb_status!]!,
      $maxAttempts: Int!,
      $after: timestamptz!,
      $limit: Int!
    ) {
      ${table}(
        where: {
          thumbnail_status: { _in: $statuses },
          thumbnail_attempts: { _lt: $maxAttempts },
          created_at: { _gt: $after }
        },
        order_by: { created_at: asc },
        limit: $limit
      ) {
        id
        created_at
      }
    }
  `;
}

/** Rows stuck in processing (worker died) older than a cutoff. */
export function stuckProcessingQuery(
  sourceType: ThumbnailSourceType
): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    query ThumbnailStuckProcessing($before: timestamptz!, $limit: Int!) {
      ${table}(
        where: {
          thumbnail_status: { _eq: "processing" },
          thumbnail_last_attempt_at: { _lt: $before }
        },
        order_by: { thumbnail_last_attempt_at: asc },
        limit: $limit
      ) {
        id
      }
    }
  `;
}

/** Never-attempted pending rows (e.g. inserted directly via GraphQL) older than a cutoff. */
export function unprocessedPendingQuery(
  sourceType: ThumbnailSourceType
): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    query ThumbnailUnprocessedPending($before: timestamptz!, $limit: Int!) {
      ${table}(
        where: {
          thumbnail_status: { _eq: "pending" },
          thumbnail_attempts: { _eq: 0 },
          created_at: { _lt: $before }
        },
        order_by: { created_at: asc },
        limit: $limit
      ) {
        id
      }
    }
  `;
}

export function releaseStuckMutation(
  sourceType: ThumbnailSourceType
): string {
  const table = THUMBNAIL_TABLES[sourceType];
  return `
    mutation ReleaseStuckThumbnails($ids: [uuid!]!) {
      update_${table}(
        where: { id: { _in: $ids }, thumbnail_status: { _eq: "processing" } },
        _set: { thumbnail_status: "pending" }
      ) {
        affected_rows
      }
    }
  `;
}
