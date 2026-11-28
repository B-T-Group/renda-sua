export type ExportProgressStepKey =
  | 'review'
  | 'proforma'
  | 'deposit'
  | 'production'
  | 'balance'
  | 'shipping'
  | 'delivered';

export const EXPORT_PROGRESS_STEPS: { key: ExportProgressStepKey; title: string }[] = [
  { key: 'review', title: 'Review' },
  { key: 'proforma', title: 'Proforma' },
  { key: 'deposit', title: 'Deposit' },
  { key: 'production', title: 'Production' },
  { key: 'balance', title: 'Balance' },
  { key: 'shipping', title: 'Shipping' },
  { key: 'delivered', title: 'Delivered' },
];

const STEP_BY_STATUS: Record<string, ExportProgressStepKey> = {
  SUBMITTED: 'review',
  IN_REVIEW: 'review',
  CHANGES_REQUESTED: 'review',
  MFR_QUOTE: 'review',
  PROFORMA_ISSUED: 'proforma',
  INVOICED: 'deposit',
  DEPOSIT_REQUIRED: 'deposit',
  DEPOSIT_RECEIVED: 'deposit',
  IN_PRODUCTION: 'production',
  READY: 'production',
  BALANCE_REQUIRED: 'balance',
  PAID_IN_FULL: 'balance',
  FINANCED_30: 'balance',
  FINANCED_60: 'balance',
  SHIPPED: 'shipping',
  DELIVERED: 'delivered',
  CLOSED: 'delivered',
  REVIEWED: 'delivered',
};

const STOPPED = new Set(['REJECTED', 'CANCELLED']);

export function exportOrderIsStopped(status: string): boolean {
  return STOPPED.has(status);
}

/** Index in EXPORT_PROGRESS_STEPS, or -1 for stopped or unknown statuses. */
export function exportOrderProgressIndex(status: string): number {
  const key = STEP_BY_STATUS[status];
  return EXPORT_PROGRESS_STEPS.findIndex((step) => step.key === key);
}

export interface ExportNextStepHint {
  title: string;
  body: string;
}

const REVIEW_HINT: ExportNextStepHint = {
  title: "We're reviewing your request",
  body: 'Our export team checks the item, quantity and destination. You will hear from us if anything needs to change.',
};

const HINT_BY_STATUS: Record<string, ExportNextStepHint> = {
  SUBMITTED: REVIEW_HINT,
  IN_REVIEW: REVIEW_HINT,
  CHANGES_REQUESTED: {
    title: 'We need a change to your request',
    body: 'Our export team asked for a change and will be in touch with the details.',
  },
  MFR_QUOTE: {
    title: 'Confirming your price',
    body: 'We are confirming the quote with the manufacturer. Your proforma follows.',
  },
  PROFORMA_ISSUED: {
    title: 'Your proforma is ready',
    body: 'Review it and approve to continue, or ask for an adjustment.',
  },
  INVOICED: {
    title: 'Your invoice is issued',
    body: 'Once your deposit is received, production starts.',
  },
  DEPOSIT_REQUIRED: {
    title: 'Pay your deposit',
    body: 'Once your deposit is received, production starts.',
  },
  DEPOSIT_RECEIVED: {
    title: 'Deposit received',
    body: 'Thank you. Your order moves to production next.',
  },
  IN_PRODUCTION: {
    title: 'Your order is being made',
    body: 'The manufacturer is producing your goods. We will update you when they are ready.',
  },
  READY: {
    title: 'Your goods are ready',
    body: 'Next comes the balance payment, then shipping.',
  },
  BALANCE_REQUIRED: {
    title: 'Choose how to pay the balance',
    body: 'Pay in full or pick a financing option. Shipping follows.',
  },
  PAID_IN_FULL: {
    title: 'Balance settled',
    body: 'Your goods will ship soon.',
  },
  FINANCED_30: {
    title: 'Financing in place',
    body: 'Your goods will ship soon.',
  },
  FINANCED_60: {
    title: 'Financing in place',
    body: 'Your goods will ship soon.',
  },
  SHIPPED: {
    title: 'Your goods are on the way',
    body: 'Confirm delivery once they arrive.',
  },
  DELIVERED: {
    title: 'Delivered',
    body: 'Your export order is complete.',
  },
  CLOSED: {
    title: 'Order closed',
    body: 'Your export order is complete.',
  },
  REVIEWED: {
    title: 'Order closed',
    body: 'Your export order is complete.',
  },
  REJECTED: {
    title: 'This request was declined',
    body: 'Contact support if you have questions about this order.',
  },
  CANCELLED: {
    title: 'This order was cancelled',
    body: 'Contact support if you have questions about this order.',
  },
};

export function exportOrderNextStepHint(status: string): ExportNextStepHint | null {
  return HINT_BY_STATUS[status] ?? null;
}

const DOC_LABELS: Record<string, string> = {
  BC: 'Purchase order',
  PRO: 'Proforma invoice',
  FAC: 'Invoice',
  REC: 'Receipt',
};

export function exportOrderDocLabel(docType: string): string {
  return DOC_LABELS[docType] ?? docType;
}
