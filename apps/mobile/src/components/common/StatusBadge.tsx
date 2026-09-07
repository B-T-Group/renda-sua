import React, { useMemo } from 'react';
import { StatusPill, type StatusPillProps } from './StatusPill';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/theme';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'failed';

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export type StatusBadgeVariant = OrderStatus | StockStatus | PaymentStatus;

interface StatusConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon?: StatusPillProps['icon'];
}

function buildStatusMap(colors: ThemeColors): Record<StatusBadgeVariant, StatusConfig> {
  return {
    pending: {
      label: 'Pending',
      backgroundColor: colors.warningTint,
      textColor: colors.warning.dark,
      icon: 'clock-outline',
    },
    confirmed: {
      label: 'Confirmed',
      backgroundColor: colors.infoTint,
      textColor: colors.info.dark,
      icon: 'check-circle-outline',
    },
    in_transit: {
      label: 'In Transit',
      backgroundColor: colors.primaryTint,
      textColor: colors.primary.dark,
      icon: 'truck-delivery-outline',
    },
    delivered: {
      label: 'Delivered',
      backgroundColor: colors.successTint,
      textColor: colors.success.dark,
      icon: 'check-circle',
    },
    cancelled: {
      label: 'Cancelled',
      backgroundColor: colors.errorTint,
      textColor: colors.error.dark,
      icon: 'close-circle-outline',
    },
    refunded: {
      label: 'Refunded',
      backgroundColor: colors.warningTint,
      textColor: colors.warning.dark,
      icon: 'cash-refund',
    },
    failed: {
      label: 'Failed',
      backgroundColor: colors.errorTint,
      textColor: colors.error.dark,
      icon: 'alert-circle-outline',
    },
    in_stock: {
      label: 'In Stock',
      backgroundColor: colors.successTint,
      textColor: colors.success.dark,
      icon: 'check-circle',
    },
    low_stock: {
      label: 'Low Stock',
      backgroundColor: colors.warningTint,
      textColor: colors.warning.dark,
      icon: 'alert-outline',
    },
    out_of_stock: {
      label: 'Out of Stock',
      backgroundColor: colors.errorTint,
      textColor: colors.error.dark,
      icon: 'close-circle-outline',
    },
    paid: {
      label: 'Paid',
      backgroundColor: colors.successTint,
      textColor: colors.success.dark,
      icon: 'check-circle',
    },
  };
}

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  /** Override the default label for the given status variant */
  label?: string;
  compact?: boolean;
  /** If true, always show the status icon */
  showIcon?: boolean;
  style?: StatusPillProps['style'];
}

/**
 * Preset status badge with semantic color and icon per status variant.
 */
export function StatusBadge({ variant, label, compact, showIcon = true, style }: StatusBadgeProps) {
  const { colors } = useTheme();
  const statusMap = useMemo(() => buildStatusMap(colors), [colors]);
  const config = statusMap[variant] ?? {
    label: variant,
    backgroundColor: colors.disabled,
    textColor: colors.text.secondary,
  };

  return (
    <StatusPill
      label={label ?? config.label}
      backgroundColor={config.backgroundColor}
      textColor={config.textColor}
      icon={showIcon ? config.icon : undefined}
      compact={compact}
      style={style}
    />
  );
}
