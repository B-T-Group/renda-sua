import type { ChipProps } from '@mui/material';
import { brandTokens } from '../../../theme/brandTokens';

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

/** Soft surface tint matching each chip colour, so cards and chips agree. */
const CHIP_COLOR_TINTS: Partial<Record<OrderStatusChipColor, string>> = {
  primary: brandTokens.tint.primary,
  secondary: brandTokens.tint.secondary,
  info: brandTokens.info.soft,
  success: brandTokens.success.soft,
  warning: brandTokens.warning.soft,
  error: brandTokens.error.soft,
};

const NEUTRAL_STATUS_TINT = brandTokens.surface.subtle;

export function getStatusChipColor(status: string): OrderStatusChipColor {
  return STATUS_CHIP_COLORS[status] ?? 'default';
}

export function getOrderStatusBoxColor(status: string): string {
  return (
    CHIP_COLOR_TINTS[getStatusChipColor(status)] ?? NEUTRAL_STATUS_TINT
  );
}
