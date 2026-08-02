import type { ChipProps } from '@mui/material';

export type OrderStatusChipColor = NonNullable<ChipProps['color']>;

const STATUS_CHIP_COLORS: Record<string, OrderStatusChipColor> = {
  pending: 'warning',
  pending_payment: 'warning',
  confirmed: 'info',
  preparing: 'primary',
  ready_for_pickup: 'secondary',
  assigned_to_agent: 'info',
  picked_up: 'primary',
  in_transit: 'primary',
  out_for_delivery: 'secondary',
  delivered: 'success',
  complete: 'success',
  completed: 'success',
  cancelled: 'error',
  failed: 'error',
  refunded: 'default',
  refund_requested: 'warning',
  refund_approved_full: 'info',
  refund_approved_partial: 'info',
  refund_approved_replace: 'info',
  refund_processing: 'info',
  refund_rejected: 'error',
  refund_failed: 'error',
};

export const ORDER_STATUS_BOX_COLORS: Record<string, string> = {
  pending: '#fff3e0',
  pending_payment: '#fff8e1',
  confirmed: '#e3f2fd',
  preparing: '#e3f2fd',
  ready_for_pickup: '#e8eaf6',
  assigned_to_agent: '#e8eaf6',
  picked_up: '#e1f5fe',
  in_transit: '#e1f5fe',
  out_for_delivery: '#e0f7fa',
  delivered: '#e8f5e9',
  complete: '#e8f5e9',
  completed: '#e8f5e9',
  cancelled: '#ffebee',
  failed: '#ffebee',
};

export function getStatusChipColor(status: string): OrderStatusChipColor {
  return STATUS_CHIP_COLORS[status] ?? 'default';
}

export function getOrderStatusBoxColor(status: string): string {
  return ORDER_STATUS_BOX_COLORS[status] ?? '#f5f5f5';
}
