import type { ThemeColors } from '../theme/colors';

export type OrderStatusChipColors = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
};

type Tone = 'warning' | 'info' | 'primary' | 'success' | 'cta' | 'error' | 'neutral';

const STATUS_TONE: Record<string, Tone> = {
  pending: 'warning',
  pending_payment: 'info',
  confirmed: 'primary',
  preparing: 'cta',
  ready_for_pickup: 'success',
  assigned_to_agent: 'primary',
  picked_up: 'primary',
  in_transit: 'primary',
  out_for_delivery: 'primary',
  in_delivery: 'primary',
  shipped: 'primary',
  awaiting_shipment: 'info',
  awaiting_client_confirmation: 'success',
  pending_auto_complete: 'info',
  delivered: 'success',
  complete: 'success',
  cancelled: 'error',
  failed: 'error',
  disputed: 'error',
  refund_requested: 'warning',
  refund_approved_full: 'success',
  refund_approved_partial: 'warning',
  refund_approved_replace: 'info',
  refund_rejected: 'error',
  refund_processing: 'info',
  refund_failed: 'error',
  refunded: 'warning',
};

function chip(backgroundColor: string, textColor: string, accent: string): OrderStatusChipColors {
  return { backgroundColor, textColor, borderColor: accent, dotColor: accent };
}

function palette(tone: Tone, colors: ThemeColors): OrderStatusChipColors {
  if (tone === 'warning') return chip(colors.warningTint, colors.warning.dark, colors.warning.main);
  if (tone === 'info') return chip(colors.infoTint, colors.info.dark, colors.info.main);
  if (tone === 'primary') return chip(colors.primaryTint, colors.primary.dark, colors.primary.main);
  if (tone === 'success') return chip(colors.successTint, colors.success.dark, colors.success.main);
  if (tone === 'cta') return chip(colors.cta.soft, colors.cta.dark, colors.cta.main);
  if (tone === 'error') return chip(colors.errorTint, colors.error.dark, colors.error.main);
  return chip(colors.surface, colors.text.secondary, colors.divider);
}

export function orderStatusChipColors(status: string | null | undefined, colors: ThemeColors): OrderStatusChipColors {
  return palette(STATUS_TONE[status ?? ''] ?? 'neutral', colors);
}
