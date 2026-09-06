export interface QuickCommentDef {
  id: string;
  labelKey: string;
  labelDefault: string;
}

const CLIENT_POSITIVE: QuickCommentDef[] = [
  {
    id: 'polite',
    labelKey: 'orders.deliverySuccess.quickComments.polite',
    labelDefault: 'Client was polite',
  },
  {
    id: 'onTime',
    labelKey: 'orders.deliverySuccess.quickComments.onTime',
    labelDefault: 'Client was on time',
  },
  {
    id: 'ready',
    labelKey: 'orders.deliverySuccess.quickComments.ready',
    labelDefault: 'Client was ready',
  },
  {
    id: 'professional',
    labelKey: 'orders.deliverySuccess.quickComments.professional',
    labelDefault: 'Service was professional',
  },
  {
    id: 'easyToFind',
    labelKey: 'orders.deliverySuccess.quickComments.easyToFind',
    labelDefault: 'Easy to find',
  },
  {
    id: 'clearInstructions',
    labelKey: 'orders.deliverySuccess.quickComments.clearInstructions',
    labelDefault: 'Clear instructions',
  },
];

const CLIENT_CONSTRUCTIVE: QuickCommentDef[] = [
  {
    id: 'hardToFind',
    labelKey: 'orders.deliverySuccess.quickComments.hardToFind',
    labelDefault: 'Hard to find',
  },
  {
    id: 'notReady',
    labelKey: 'orders.deliverySuccess.quickComments.notReady',
    labelDefault: 'Client was not ready',
  },
  {
    id: 'late',
    labelKey: 'orders.deliverySuccess.quickComments.late',
    labelDefault: 'Client was late',
  },
  {
    id: 'unclearInstructions',
    labelKey: 'orders.deliverySuccess.quickComments.unclearInstructions',
    labelDefault: 'Unclear instructions',
  },
  {
    id: 'unprofessional',
    labelKey: 'orders.deliverySuccess.quickComments.unprofessional',
    labelDefault: 'Unprofessional',
  },
];

/** Positive chips for 4–5 stars; constructive chips for 1–3. */
export function clientQuickCommentsForStars(stars: number): QuickCommentDef[] {
  if (stars <= 0) return [];
  return stars >= 4 ? CLIENT_POSITIVE : CLIENT_CONSTRUCTIVE;
}

export function pruneQuickCommentIds(
  selected: string[],
  allowed: ReadonlyArray<Pick<QuickCommentDef, 'id'>>
): string[] {
  const ids = new Set(allowed.map((c) => c.id));
  return selected.filter((id) => ids.has(id));
}

export function labelsForSelectedComments(
  selected: string[],
  defs: ReadonlyArray<QuickCommentDef>,
  translate: (key: string, fallback: string) => string
): string[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  return selected.flatMap((id) => {
    const def = byId.get(id);
    return def ? [translate(def.labelKey, def.labelDefault)] : [];
  });
}

export function composeRatingComment(labels: string[], extra: string): string {
  const chips = labels.map((l) => l.trim()).filter(Boolean);
  const more = extra.trim();
  if (chips.length === 0) return more;
  const chipText = chips.join('. ');
  if (!more) return chipText;
  const prefix = /[.!?]$/.test(chipText) ? chipText : `${chipText}.`;
  return `${prefix} ${more}`;
}

export function toggleQuickCommentId(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}
