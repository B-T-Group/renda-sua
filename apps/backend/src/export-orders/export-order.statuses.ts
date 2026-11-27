export const EXPORT_ORDER_STATUSES = [
  'SUBMITTED',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'REJECTED',
  'MFR_QUOTE',
  'PROFORMA_ISSUED',
  'INVOICED',
  'DEPOSIT_REQUIRED',
  'DEPOSIT_RECEIVED',
  'CANCELLED',
  'IN_PRODUCTION',
  'READY',
  'BALANCE_REQUIRED',
  'PAID_IN_FULL',
  'FINANCED_30',
  'FINANCED_60',
  'SHIPPED',
  'DELIVERED',
  'CLOSED',
  'REVIEWED',
] as const;

export type ExportOrderStatus = (typeof EXPORT_ORDER_STATUSES)[number];

/** Allowed next statuses. Unlisted transitions are refused by the API. */
export const EXPORT_TRANSITIONS: Record<ExportOrderStatus, ExportOrderStatus[]> =
  {
    SUBMITTED: ['IN_REVIEW'],
    IN_REVIEW: ['MFR_QUOTE', 'CHANGES_REQUESTED', 'REJECTED'],
    CHANGES_REQUESTED: ['IN_REVIEW'],
    REJECTED: [],
    MFR_QUOTE: ['PROFORMA_ISSUED'],
    PROFORMA_ISSUED: ['INVOICED', 'PROFORMA_ISSUED', 'REJECTED'],
    INVOICED: ['DEPOSIT_REQUIRED'],
    DEPOSIT_REQUIRED: ['DEPOSIT_RECEIVED', 'CANCELLED'],
    DEPOSIT_RECEIVED: ['IN_PRODUCTION'],
    CANCELLED: [],
    IN_PRODUCTION: ['READY'],
    READY: ['BALANCE_REQUIRED'],
    BALANCE_REQUIRED: ['PAID_IN_FULL', 'FINANCED_30', 'FINANCED_60'],
    PAID_IN_FULL: ['SHIPPED'],
    FINANCED_30: ['SHIPPED'],
    FINANCED_60: ['SHIPPED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: ['CLOSED', 'REVIEWED'],
    CLOSED: ['REVIEWED'],
    REVIEWED: [],
  };

export function assertTransition(
  from: ExportOrderStatus,
  to: ExportOrderStatus
): void {
  const allowed = EXPORT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid export order transition ${from} → ${to}`);
  }
}

export const EXPORT_EVENTS = {
  submitted: 'order.submitted',
  reviewStarted: 'order.review_started',
  changesRequested: 'order.changes_requested',
  rejected: 'order.rejected',
  approved: 'order.approved',
  mfrQuoteConfirmed: 'mfr_quote.confirmed',
  proformaIssued: 'proforma.issued',
  proformaValidated: 'proforma.validated',
  invoiceIssued: 'invoice.issued',
  paymentRecorded: 'payment.recorded',
  receiptIssued: 'receipt.issued',
  commissionAccrued: 'commission.accrued',
  supplierDepositSent: 'supplier_payment.deposit_sent',
  productionStarted: 'production.started',
  productionReady: 'production.ready',
  balanceOptionSelected: 'balance.option_selected',
  financingApproved: 'financing.approved',
  supplierBalanceSent: 'supplier_payment.balance_sent',
  creditNoteIssued: 'credit_note.issued',
  shipmentDispatched: 'shipment.dispatched',
  delivered: 'order.delivered',
  financingReminder: 'financing.reminder_sent',
  financingOverdue: 'financing.overdue',
  closed: 'order.closed',
  ratingSubmitted: 'rating.submitted',
  commissionReversed: 'commission.reversed',
} as const;
