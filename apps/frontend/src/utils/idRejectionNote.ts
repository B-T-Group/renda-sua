/** Must match backend `ID_REJECTION_NOTE_PREFIX` in upload.service.ts */
export const ID_REJECTION_NOTE_PREFIX = '[REJECTED] ';

/** True when note is an admin rejection (prefixed or legacy plain reason). */
export function isIdRejectionNote(note: string | null | undefined): boolean {
  return Boolean(note?.trim());
}

/** Strip the stored rejection marker for display. */
export function displayIdRejectionNote(
  note: string | null | undefined
): string {
  const trimmed = note?.trim() || '';
  if (!trimmed.startsWith(ID_REJECTION_NOTE_PREFIX)) return trimmed;
  return trimmed.slice(ID_REJECTION_NOTE_PREFIX.length).trim() || trimmed;
}
