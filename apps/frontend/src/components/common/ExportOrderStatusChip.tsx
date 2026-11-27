import { Chip, type ChipProps } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  exportOrderStatusColor,
  exportOrderStatusLabel,
} from '../../utils/exportOrders/exportOrderStatus';

interface ExportOrderStatusChipProps {
  status: string;
  size?: ChipProps['size'];
  sx?: ChipProps['sx'];
}

export const ExportOrderStatusChip: React.FC<ExportOrderStatusChipProps> = ({
  status,
  size,
  sx,
}) => {
  const { t } = useTranslation();
  return (
    <Chip
      size={size}
      sx={sx}
      color={exportOrderStatusColor(status)}
      label={exportOrderStatusLabel(t, status)}
    />
  );
};
