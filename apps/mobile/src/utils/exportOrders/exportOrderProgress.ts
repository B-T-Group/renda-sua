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
  icon: string;
  title: string;
  body: string;
}

const REVIEW_HINT: ExportNextStepHint = {
  icon: 'clipboard-search-outline',
  title: "We're reviewing your request",
  body: 'Our export team checks the item, quantity and destination. You will hear from us if anything needs to change.',
};

const HINT_BY_STATUS: Record<string, ExportNextStepHint> = {
  SUBMITTED: REVIEW_HINT,
  IN_REVIEW: REVIEW_HINT,
  CHANGES_REQUESTED: {
    icon: 'message-alert-outline',
    title: 'We need a change to your request',
    body: 'Our export team asked for a change and will be in touch with the details.',
  },
  MFR_QUOTE: {
    icon: 'factory',
    title: 'Confirming your price',
    body: 'We are confirming the quote with the manufacturer. Your proforma follows.',
  },
  PROFORMA_ISSUED: {
    icon: 'file-document-check-outline',
    title: 'Your proforma is ready',
    body: 'Review it and approve to continue, or ask for an adjustment.',
  },
  INVOICED: {
    icon: 'receipt-text-outline',
    title: 'Your invoice is issued',
    body: 'Once your deposit is received, production starts.',
  },
  DEPOSIT_REQUIRED: {
    icon: 'cash-clock',
    title: 'Pay your deposit',
    body: 'Once your deposit is received, production starts.',
  },
  DEPOSIT_RECEIVED: {
    icon: 'cash-check',
    title: 'Deposit received',
    body: 'Thank you. Your order moves to production next.',
  },
  IN_PRODUCTION: {
    icon: 'factory',
    title: 'Your order is being made',
    body: 'The manufacturer is producing your goods. We will update you when they are ready.',
  },
  READY: {
    icon: 'package-variant-closed-check',
    title: 'Your goods are ready',
    body: 'Next comes the balance payment, then shipping.',
  },
  BALANCE_REQUIRED: {
    icon: 'cash-multiple',
    title: 'Choose how to pay the balance',
    body: 'Pay in full or pick a financing option. Shipping follows.',
  },
  PAID_IN_FULL: {
    icon: 'check-decagram-outline',
    title: 'Balance settled',
    body: 'Your goods will ship soon.',
  },
  FINANCED_30: {
    icon: 'calendar-clock',
    title: 'Financing in place',
    body: 'Your goods will ship soon.',
  },
  FINANCED_60: {
    icon: 'calendar-clock',
    title: 'Financing in place',
    body: 'Your goods will ship soon.',
  },
  SHIPPED: {
    icon: 'truck-delivery-outline',
    title: 'Your goods are on the way',
    body: 'Confirm delivery once they arrive.',
  },
  DELIVERED: {
    icon: 'package-variant-closed-check',
    title: 'Delivered',
    body: 'Your export order is complete.',
  },
  CLOSED: {
    icon: 'check-circle-outline',
    title: 'Order closed',
    body: 'Your export order is complete.',
  },
  REVIEWED: {
    icon: 'check-circle-outline',
    title: 'Order closed',
    body: 'Your export order is complete.',
  },
  REJECTED: {
    icon: 'close-circle-outline',
    title: 'This request was declined',
    body: 'Contact support if you have questions about this order.',
  },
  CANCELLED: {
    icon: 'cancel',
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
