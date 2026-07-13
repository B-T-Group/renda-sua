import { HasuraSystemService } from '../hasura/hasura-system.service';

const GET_LATEST_ENTITY_MESSAGE = `
  query GetLatestEntityMessage(
    $entityType: entity_types_enum!
    $entityId: uuid!
  ) {
    user_messages(
      where: {
        entity_type: { _eq: $entityType }
        entity_id: { _eq: $entityId }
      }
      order_by: { created_at: desc }
      limit: 1
    ) {
      message
    }
  }
`;

const GET_LATEST_ITEM_AI_REASON = `
  query GetLatestItemAiRejectionReason($itemId: uuid!) {
    item_ai_reviews(
      where: { item_id: { _eq: $itemId }, status: { _eq: rejected } }
      order_by: { created_at: desc }
      limit: 1
    ) {
      decision_reason
    }
  }
`;

const GET_LATEST_LISTING_AI_REASON = `
  query GetLatestListingAiRejectionReason($listingId: uuid!) {
    rental_listing_ai_reviews(
      where: {
        listing_id: { _eq: $listingId }
        status: { _eq: rejected }
      }
      order_by: { created_at: desc }
      limit: 1
    ) {
      decision_reason
    }
  }
`;

const GET_LISTING_MESSAGES_BATCH = `
  query GetListingRejectionMessages($entityIds: [uuid!]!) {
    user_messages(
      where: {
        entity_type: { _eq: rental_listing }
        entity_id: { _in: $entityIds }
      }
      order_by: { created_at: desc }
    ) {
      entity_id
      message
    }
  }
`;

const GET_LISTING_AI_REASONS_BATCH = `
  query GetListingAiRejectionReasons($listingIds: [uuid!]!) {
    rental_listing_ai_reviews(
      where: {
        listing_id: { _in: $listingIds }
        status: { _eq: rejected }
      }
      order_by: { created_at: desc }
    ) {
      listing_id
      decision_reason
    }
  }
`;

type MessageRow = { message: string | null };
type AiReasonRow = { decision_reason: string | null };

function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

async function latestEntityMessage(
  hasura: HasuraSystemService,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const result = await hasura.executeQuery<{
    user_messages: MessageRow[];
  }>(GET_LATEST_ENTITY_MESSAGE, { entityType, entityId });
  return firstNonEmpty(result.user_messages?.[0]?.message);
}

/** Prefer admin message, then AI decision_reason. */
export async function resolveSaleItemRejectionReason(
  hasura: HasuraSystemService,
  itemId: string
): Promise<string | null> {
  const message = await latestEntityMessage(hasura, 'sale_item', itemId);
  if (message) return message;
  const result = await hasura.executeQuery<{
    item_ai_reviews: AiReasonRow[];
  }>(GET_LATEST_ITEM_AI_REASON, { itemId });
  return firstNonEmpty(result.item_ai_reviews?.[0]?.decision_reason);
}

/** Prefer admin message, then AI decision_reason. */
export async function resolveRentalListingRejectionReason(
  hasura: HasuraSystemService,
  listingId: string
): Promise<string | null> {
  const message = await latestEntityMessage(hasura, 'rental_listing', listingId);
  if (message) return message;
  const result = await hasura.executeQuery<{
    rental_listing_ai_reviews: AiReasonRow[];
  }>(GET_LATEST_LISTING_AI_REASON, { listingId });
  return firstNonEmpty(result.rental_listing_ai_reviews?.[0]?.decision_reason);
}

/** Batch-resolve rejection reasons for rental listings (admin message > AI). */
export async function resolveRentalListingRejectionReasons(
  hasura: HasuraSystemService,
  listingIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!listingIds.length) return map;

  const [messages, aiReviews] = await Promise.all([
    hasura.executeQuery<{
      user_messages: Array<{ entity_id: string; message: string | null }>;
    }>(GET_LISTING_MESSAGES_BATCH, { entityIds: listingIds }),
    hasura.executeQuery<{
      rental_listing_ai_reviews: Array<{
        listing_id: string;
        decision_reason: string | null;
      }>;
    }>(GET_LISTING_AI_REASONS_BATCH, { listingIds }),
  ]);

  for (const row of messages.user_messages ?? []) {
    const reason = firstNonEmpty(row.message);
    if (reason && !map.has(row.entity_id)) map.set(row.entity_id, reason);
  }
  for (const row of aiReviews.rental_listing_ai_reviews ?? []) {
    const reason = firstNonEmpty(row.decision_reason);
    if (reason && !map.has(row.listing_id)) map.set(row.listing_id, reason);
  }
  return map;
}
