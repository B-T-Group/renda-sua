import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type MerchantLifecycleStatus =
  | 'created'
  | 'contract_signed'
  | 'active'
  | 'suspended';

interface MerchantStatusChipProps {
  lifecycleStatus?: MerchantLifecycleStatus | string | null;
  canAcceptOrders?: boolean;
  /** @deprecated Alias of canAcceptOrders; ignored for display. */
  isStorefrontVisible?: boolean;
}

export const MerchantStatusChip: React.FC<MerchantStatusChipProps> = ({
  lifecycleStatus,
  canAcceptOrders,
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

  return (
    <Chip
      size="small"
      variant="outlined"
      label={t('business.lifecycle.onboarding', 'Onboarding')}
    />
  );
};
