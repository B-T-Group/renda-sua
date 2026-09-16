export const REEL_STUCK_AFTER_MS = 15 * 60_000;

const IN_PROGRESS = new Set([
  'generating',
  'queued',
  'processing',
  'awaiting_upload',
]);

const RETRYABLE_STUCK = new Set(['queued', 'processing']);

export function isMerchantReelStuck(params: {
  processingStatus?: string | null;
  updatedAt?: string | null;
  nowMs?: number;
}): boolean {
  const status = params.processingStatus || '';
  if (!IN_PROGRESS.has(status)) return false;
  if (!params.updatedAt) return false;
  const updated = Date.parse(params.updatedAt);
  if (!Number.isFinite(updated)) return false;
  return (params.nowMs ?? Date.now()) - updated >= REEL_STUCK_AFTER_MS;
}

export function canForceRetryMerchantReel(params: {
  processingStatus?: string | null;
  updatedAt?: string | null;
  sourceS3Key?: string | null;
  nowMs?: number;
}): boolean {
  if (!params.sourceS3Key) return false;
  if (params.processingStatus === 'failed') return true;
  return (
    isMerchantReelStuck(params) &&
    RETRYABLE_STUCK.has(params.processingStatus || '')
  );
}

export function canCancelMerchantReel(params: {
  processingStatus?: string | null;
  updatedAt?: string | null;
  nowMs?: number;
}): boolean {
  if (params.processingStatus === 'failed') return true;
  return isMerchantReelStuck(params);
}
