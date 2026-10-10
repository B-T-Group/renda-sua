import { useEffect, useState } from 'react';
import {
  useAiImageCleanup,
  type AiImageCleanupPendingData,
} from './useAiImageCleanup';

type OpenJob = { status: string | null; jobId: string | null };

export function usePhotoReviewJobId(options: {
  enabled: boolean;
  itemId?: string | null;
  rentalImageIds?: string[];
}): string | null {
  const { getOpenForItem, getPending } = useAiImageCleanup();
  const rentalKey = (options.rentalImageIds ?? []).join(',');
  return useResolvedPhotoReviewJob(
    options.enabled,
    options.itemId,
    rentalKey,
    getOpenForItem,
    getPending
  );
}

function useResolvedPhotoReviewJob(
  enabled: boolean,
  itemId: string | null | undefined,
  rentalKey: string,
  getOpenForItem: (id: string) => Promise<OpenJob>,
  getPending: () => Promise<AiImageCleanupPendingData>
): string | null {
  const [jobId, setJobId] = useState<string | null>(null);
  useEffect(() => {
    return watchPhotoReviewJob(enabled, () =>
      resolvePhotoReviewJob({ itemId, rentalKey, getOpenForItem, getPending })
    , setJobId);
  }, [enabled, itemId, rentalKey, getOpenForItem, getPending]);
  return jobId;
}

function watchPhotoReviewJob(
  enabled: boolean,
  load: () => Promise<string | null>,
  setJobId: (id: string | null) => void
): () => void {
  if (!enabled) {
    setJobId(null);
    return () => undefined;
  }
  let cancelled = false;
  void load().then((id) => {
    if (!cancelled) setJobId(id);
  });
  return () => {
    cancelled = true;
  };
}

async function resolvePhotoReviewJob(input: {
  itemId?: string | null;
  rentalKey: string;
  getOpenForItem: (itemId: string) => Promise<OpenJob>;
  getPending: () => Promise<AiImageCleanupPendingData>;
}): Promise<string | null> {
  if (input.itemId) return itemPhotoReviewJob(input.getOpenForItem, input.itemId);
  if (!input.rentalKey) return null;
  return rentalPhotoReviewJob(input.getPending, input.rentalKey.split(','));
}

async function itemPhotoReviewJob(
  getOpenForItem: (itemId: string) => Promise<OpenJob>,
  itemId: string
): Promise<string | null> {
  try {
    const open = await getOpenForItem(itemId);
    return open.status === 'ready_for_review' ? open.jobId : null;
  } catch {
    return null;
  }
}

async function rentalPhotoReviewJob(
  getPending: () => Promise<AiImageCleanupPendingData>,
  imageIds: string[]
): Promise<string | null> {
  try {
    const pending = await getPending();
    return matchRentalPhotoJob(pending, new Set(imageIds));
  } catch {
    return null;
  }
}

function matchRentalPhotoJob(
  pending: AiImageCleanupPendingData,
  imageIds: Set<string>
): string | null {
  const job = pending.jobs.find(
    (row) =>
      row.status === 'ready_for_review' &&
      (row.results ?? []).some(
        (result) =>
          !!result.rental_item_image_id && imageIds.has(result.rental_item_image_id)
      )
  );
  return job?.id ?? null;
}
