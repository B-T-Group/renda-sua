import { CheckCircle } from '@mui/icons-material';
import { Chip, type ChipProps } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusChipColor } from './statusColors';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: ChipProps['size'];
  showCompletedIcon?: boolean;
  sx?: ChipProps['sx'];
}

const COMPLETED = new Set(['delivered', 'complete', 'completed']);

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'small',
  showCompletedIcon = false,
  sx,
}) => {
  const { t } = useTranslation();
  const display =
    label ?? t(`common.orderStatus.${status}`, status.replace(/_/g, ' '));
  const isCompleted = COMPLETED.has(status);

  return (
    <Chip
      label={display}
      color={getStatusChipColor(status)}
      size={size}
      sx={{ fontWeight: 600, height: size === 'small' ? 22 : undefined, ...sx }}
      icon={
        showCompletedIcon && isCompleted ? (
          <CheckCircle sx={{ fontSize: 14 }} />
        ) : undefined
      }
    />
  );
};

export default StatusBadge;
