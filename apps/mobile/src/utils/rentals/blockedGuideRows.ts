export interface BlockedGuideGap {
  unitId: string;
  slotKey: string;
  required: boolean;
}

export interface BlockedGuideSlot {
  slotKey: string;
  url?: string | null;
}

export interface BlockedGuideRow {
  unitId: string;
  slotKey: string;
  required: boolean;
  thumbUrl: string | null;
  action: 'retake' | 'skip';
}

export interface BlockedSkip {
  unitId: string;
  slotKey: string;
  reason: string;
}

/** One row per missing slot. The header count is this list's length. */
export function blockedGuideRows(gaps: BlockedGuideGap[], slots: BlockedGuideSlot[]): BlockedGuideRow[] {
  return gaps.map((gap) => toRow(gap, slots, null));
}

/** Open gaps, then skipped extras that still show their reason. The CTA count stays the open gaps. */
export function blockedScreenRows(gaps: BlockedGuideGap[], skips: BlockedSkip[], slots: BlockedGuideSlot[]) {
  const open = blockedGuideRows(gaps, slots).map((row) => ({ ...row, reason: null as string | null }));
  const skipped = skips.filter((skip) => skip.reason.trim() && !gaps.some((gap) => sameSlot(gap, skip)));
  return [...open, ...skipped.map((skip) => toRow({ ...skip, required: false }, slots, skip.reason.trim()))];
}

export function submitLeftCount(gaps: { length: number }): number {
  return gaps.length;
}

export function checklistCount(rows: readonly unknown[]): number {
  return rows.length;
}

function toRow(gap: BlockedGuideGap, slots: BlockedGuideSlot[], reason: string | null): BlockedGuideRow & { reason: string | null } {
  return {
    unitId: gap.unitId,
    slotKey: gap.slotKey,
    required: gap.required,
    thumbUrl: slots.find((slot) => slot.slotKey === gap.slotKey)?.url ?? null,
    action: gap.required ? 'retake' : 'skip',
    reason,
  };
}

function sameSlot(gap: BlockedGuideGap, skip: BlockedSkip): boolean {
  return gap.unitId === skip.unitId && gap.slotKey === skip.slotKey;
}
