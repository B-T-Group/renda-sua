type Translate = (
  key: string,
  defaultValue: string,
  vars?: Record<string, unknown>
) => string;

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'Under review',
  CHANGES_REQUESTED: 'Changes requested',
  REJECTED: 'Declined',
  MFR_QUOTE: 'Preparing your quote',
  PROFORMA_ISSUED: 'Proforma ready',
  INVOICED: 'Invoiced',
  DEPOSIT_REQUIRED: 'Deposit due',
  DEPOSIT_RECEIVED: 'Deposit received',
  CANCELLED: 'Cancelled',
  IN_PRODUCTION: 'In production',
  READY: 'Ready',
  BALANCE_REQUIRED: 'Balance due',
  PAID_IN_FULL: 'Paid in full',
  FINANCED_30: 'Financed (30 days)',
  FINANCED_60: 'Financed (60 days)',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
  REVIEWED: 'Reviewed',
};

export type ExportOrderChipColor =
  | 'default'
  | 'info'
  | 'warning'
  | 'success'
  | 'error';

const ACTION_NEEDED = new Set([
  'CHANGES_REQUESTED',
  'PROFORMA_ISSUED',
  'DEPOSIT_REQUIRED',
  'BALANCE_REQUIRED',
  'SHIPPED',
]);
const DONE = new Set(['DELIVERED', 'CLOSED', 'REVIEWED', 'PAID_IN_FULL']);
const STOPPED = new Set(['REJECTED', 'CANCELLED']);

export function exportOrderStatusLabel(t: Translate, status: string): string {
  return t(
    `exportOrders.status.${status}`,
    STATUS_LABELS[status] ?? status
  );
}

export function exportOrderStatusColor(status: string): ExportOrderChipColor {
  if (STOPPED.has(status)) return 'error';
  if (ACTION_NEEDED.has(status)) return 'warning';
  if (DONE.has(status)) return 'success';
  if (status === 'SUBMITTED' || status === 'IN_REVIEW') return 'info';
  return 'default';
}
