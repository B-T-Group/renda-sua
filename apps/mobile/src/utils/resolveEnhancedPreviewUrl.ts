import type { BusinessItemImage } from '../types/business/items';
import { businessApi } from '../services/businessApi';

type CleanupJobResult = {
  status: string;
  cleaned_image_url: string | null;
  applied_at?: string | null;
  reverted_at?: string | null;
  business_image_id?: string | null;
};

function appliedCleanedUrl(results: CleanupJobResult[] | undefined): string | null {
  const hit = (results ?? []).find(
    (r) =>
      r.status === 'accepted' &&
      !!r.applied_at &&
      !r.reverted_at &&
      !!r.cleaned_image_url
  );
  return hit?.cleaned_image_url ?? null;
}

function cleanedItemImageUrl(images: BusinessItemImage[] | undefined): string | null {
  const main = images?.[0];
  if (!main?.is_ai_cleaned) return null;
  return main.display_url || main.image_url || null;
}

/** Resolve auto-applied AI cleanup URL for the create-flow review hero. */
export async function resolveEnhancedPreviewUrl(args: {
  itemId: string;
  jobId?: string | null;
}): Promise<string | null> {
  const { itemId, jobId } = args;
  if (jobId) {
    try {
      const jobRes = await businessApi.aiImageCleanup.getJob(jobId);
      const fromJob = appliedCleanedUrl(jobRes.data?.job?.results);
      if (fromJob) return fromJob;
    } catch {
      // fall through to item images
    }
  }
  try {
    const itemRes = await businessApi.catalog.getItem(itemId);
    return cleanedItemImageUrl(itemRes.data?.item?.item_images);
  } catch {
    return null;
  }
}
