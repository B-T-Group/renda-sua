import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type MerchantLifecycleStatus =
  | 'created'
  | 'catalog_ready'
  | 'payment_setup_pending'
  | 'payment_verification_pending'
  | 'active'
  | 'suspended';

interface MerchantStatusChipProps {
  lifecycleStatus?: MerchantLifecycleStatus | string | null;
  canAcceptOrders?: boolean;
  isStorefrontVisible?: boolean;
}

export const MerchantStatusChip: React.FC<MerchantStatusChipProps> = ({
  lifecycleStatus,
  canAcceptOrders,
  isStorefrontVisible,
}) => {
  const { t } = useTranslation();

  if (lifecycleStatus === 'suspended') {
    return (
      <Chip
        size="small"
        color="error"
        label={t('business.lifecycle.suspended', 'Suspended')}
      />
    );
  }

  if (canAcceptOrders || lifecycleStatus === 'active') {
    return (
      <Chip
        size="small"
        color="success"
        label={t('business.lifecycle.active', 'Active')}
      />
    );
  }

  if (isStorefrontVisible && lifecycleStatus === 'payment_verification_pending') {
    return (
      <Chip
        size="small"
        color="warning"
        label={t('business.lifecycle.verifyingPayments', 'Verifying payments')}
      />
    );
  }

  if (isStorefrontVisible) {
    return (
      <Chip
        size="small"
        color="info"
        label={t('business.lifecycle.openingSoon', 'Live · Opening soon')}
      />
    );
  }

  return (
    <Chip
      size="small"
      variant="outlined"
      label={t('business.lifecycle.draft', 'Draft')}
    />
  );
};
