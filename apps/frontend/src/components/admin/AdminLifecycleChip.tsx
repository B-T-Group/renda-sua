import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MerchantLifecycleStatus } from '../business/MerchantStatusChip';

interface AdminLifecycleChipProps {
  lifecycleStatus?: MerchantLifecycleStatus | string | null;
  size?: 'small' | 'medium';
}

function chipProps(
  status: string | null | undefined,
  t: (key: string, fallback: string) => string
): {
  label: string;
  color: 'default' | 'success' | 'warning' | 'error' | 'info';
  variant: 'filled' | 'outlined';
} {
  switch (status) {
    case 'active':
      return {
        label: t('admin.businesses.lifecycle.active', 'Active'),
        color: 'success',
        variant: 'filled',
      };
    case 'suspended':
      return {
        label: t('admin.businesses.lifecycle.suspended', 'Suspended'),
        color: 'error',
        variant: 'filled',
      };
    case 'catalog_ready':
      return {
        label: t('admin.businesses.lifecycle.catalogReady', 'Catalog ready'),
        color: 'info',
        variant: 'filled',
      };
    case 'payment_setup_pending':
      return {
        label: t(
          'admin.businesses.lifecycle.paymentSetupPending',
          'Payment setup'
        ),
        color: 'warning',
        variant: 'filled',
      };
    case 'payment_verification_pending':
      return {
        label: t(
          'admin.businesses.lifecycle.paymentVerificationPending',
          'Payment verification'
        ),
        color: 'warning',
        variant: 'filled',
      };
    case 'created':
      return {
        label: t('admin.businesses.lifecycle.draft', 'Draft'),
        color: 'default',
        variant: 'outlined',
      };
    default:
      return {
        label: status || t('admin.businesses.lifecycle.unknown', 'Unknown'),
        color: 'default',
        variant: 'outlined',
      };
  }
}

/** Admin triage chip — shows the true lifecycle_status (not collapsed Draft). */
export const AdminLifecycleChip: React.FC<AdminLifecycleChipProps> = ({
  lifecycleStatus,
  size = 'small',
}) => {
  const { t } = useTranslation();
  const props = chipProps(lifecycleStatus, t);
  return (
    <Chip
      size={size}
      color={props.color}
      variant={props.variant}
      label={props.label}
    />
  );
};
