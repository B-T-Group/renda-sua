import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { Chip, Tooltip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminOrderRiskLevel } from '../../../hooks/useAdminOrders';
import { severityColor, severityLabel } from './orderRiskLabels';

interface OrderRiskChipProps {
  level: AdminOrderRiskLevel;
  tooltip?: string | null;
  size?: 'small' | 'medium';
}

const ICONS: Record<AdminOrderRiskLevel, React.ReactElement> = {
  critical: <ErrorIcon fontSize="small" />,
  warning: <WarningIcon fontSize="small" />,
  none: <CheckCircleIcon fontSize="small" />,
};

export const OrderRiskChip: React.FC<OrderRiskChipProps> = ({
  level,
  tooltip,
  size = 'small',
}) => {
  const { t } = useTranslation();
  const chip = (
    <Chip
      icon={ICONS[level]}
      label={severityLabel(t, level)}
      color={severityColor(level)}
      size={size}
      variant={level === 'none' ? 'outlined' : 'filled'}
    />
  );
  if (!tooltip) return chip;
  return <Tooltip title={tooltip}>{chip}</Tooltip>;
};
