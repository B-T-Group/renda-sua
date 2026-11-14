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

/** One row per missing slot. The header count is this list's length. */
export function blockedGuideRows(gaps: BlockedGuideGap[], slots: BlockedGuideSlot[]): BlockedGuideRow[] {
  return gaps.map((gap) => ({
    unitId: gap.unitId,
    slotKey: gap.slotKey,
    required: gap.required,
    thumbUrl: slots.find((slot) => slot.slotKey === gap.slotKey)?.url ?? null,
    action: gap.required ? 'retake' : 'skip',
  }));
}
