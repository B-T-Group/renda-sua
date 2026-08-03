import type {
  AiImageAction,
  AiReviewModelResult,
} from './item-ai-review.types';

/**
 * Drop AI "cleanup" recommendations when cleanup is already queued/processing/
 * ready, or when the image was already AI-cleaned — otherwise merchants get a
 * redundant CTA after they already opted in during create.
 */
export function stripRedundantCleanupRecommendations(
  result: AiReviewModelResult,
  opts: {
    cleanupJobOpen: boolean;
    cleanedImageIds: ReadonlySet<string>;
  }
): AiReviewModelResult {
  const hadCleanup = result.imageActions.some((a) => a.action === 'cleanup');
  if (!hadCleanup) return result;

  const imageActions: AiImageAction[] = result.imageActions.map((action) => {
    if (action.action !== 'cleanup') return action;
    if (
      opts.cleanupJobOpen ||
      opts.cleanedImageIds.has(action.imageId)
    ) {
      return {
        ...action,
        action: 'keep',
        note: opts.cleanupJobOpen
          ? 'AI photo cleanup already in progress'
          : 'Photo already enhanced',
      };
    }
    return action;
  });

  const stillRecommendsCleanup = imageActions.some((a) => a.action === 'cleanup');
  if (stillRecommendsCleanup) {
    return { ...result, imageActions };
  }

  return {
    ...result,
    imageActions,
    reason: scrubCleanupFromReason(result.reason),
  };
}

function scrubCleanupFromReason(reason: string): string {
  const cleaned = reason
    .replace(/\s*or use AI photo cleanup where recommended\.?/gi, '.')
    .replace(/\s*use AI photo cleanup where recommended\.?/gi, '')
    .replace(/\s*Photo cleanup recommended[^.]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || reason;
}
