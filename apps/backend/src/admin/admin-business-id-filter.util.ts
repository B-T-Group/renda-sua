export type AdminIdDocumentStatus =
  | 'missing'
  | 'pending'
  | 'rejected'
  | 'approved';

export type AdminIdDocumentStatusFilter =
  | AdminIdDocumentStatus
  | 'not_approved';

type UploadRow = { is_approved?: boolean; note?: string | null };

/**
 * Latest-upload semantics for ID docs (uploads ordered created_at desc).
 * Any approved upload wins; otherwise latest note ⇒ rejected; else pending.
 */
export function resolveIdDocumentStatus(
  uploads: UploadRow[]
): AdminIdDocumentStatus {
  if (!uploads.length) return 'missing';
  if (uploads.some((u) => u.is_approved)) return 'approved';
  const latest = uploads[0];
  if (latest?.note?.trim()) return 'rejected';
  return 'pending';
}

export function matchesIdDocumentStatusFilter(
  uploads: UploadRow[],
  status: string
): boolean {
  const resolved = resolveIdDocumentStatus(uploads);
  if (status === 'not_approved') {
    return resolved !== 'approved';
  }
  return resolved === status;
}

/** Needs attention: not yet active (or suspended). ID is optional for the badge. */
export function businessNeedsAttention(
  lifecycleStatus: string | null | undefined,
  _uploads?: UploadRow[]
): boolean {
  return lifecycleStatus !== 'active';
}
