import type { TFunction } from 'i18next';

const REFUND_REASON_KEYS: Record<string, [string, string]> = {
  not_delivered: [
    'orders.refunds.reasons.notDelivered',
    'Item was not delivered',
  ],
  wrong_item: ['orders.refunds.reasons.wrongItem', 'Wrong item'],
  damaged: ['orders.refunds.reasons.damaged', 'Damaged item'],
  quality_issue: ['orders.refunds.reasons.quality', 'Quality issue'],
  missing_parts: [
    'orders.refunds.reasons.missingParts',
    'Missing parts or accessories',
  ],
  other: ['orders.refunds.reasons.other', 'Other'],
};

export function translateRefundReason(reason: string, t: TFunction): string {
  const pair = REFUND_REASON_KEYS[reason];
  if (pair) {
    return t(pair[0], pair[1]);
  }
  return reason;
}
