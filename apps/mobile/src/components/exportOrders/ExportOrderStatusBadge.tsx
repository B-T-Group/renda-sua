import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import {
  exportOrderStatusColor,
  exportOrderStatusLabel,
  type ExportOrderChipColor,
} from '../../utils/exportOrders/exportOrderStatus';

export function ExportOrderStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const palette: Record<ExportOrderChipColor, { bg: string; fg: string }> = {
    default: { bg: colors.divider, fg: colors.text.secondary },
    info: { bg: colors.info.light, fg: colors.info.dark },
    warning: { bg: colors.warning.light, fg: colors.warning.dark },
    success: { bg: colors.success.light, fg: colors.success.dark },
    error: { bg: colors.error.light, fg: colors.error.dark },
  };
  const { bg, fg } = palette[exportOrderStatusColor(status)];
  return (
    <StatusPill
      compact
      label={exportOrderStatusLabel(t, status)}
      backgroundColor={bg}
      textColor={fg}
    />
  );
}
