import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { MerchantLifecycleFields } from '../../utils/merchantLifecycle';
import { merchantCanAcceptOrders } from '../../utils/merchantLifecycle';

type Props = MerchantLifecycleFields & {
  style?: StyleProp<ViewStyle>;
};

export function MerchantStatusChip({ style, ...fields }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lifecycleStatus = fields.lifecycle_status;
  const acceptsOrders = merchantCanAcceptOrders(fields);

  if (lifecycleStatus === 'suspended') {
    return (
      <StatusPill
        label={t('business.lifecycle.suspended', 'Suspended')}
        backgroundColor={colors.error.light + '30'}
        textColor={colors.error.dark}
        icon="pause-circle-outline"
        compact
        style={style}
      />
    );
  }

  if (acceptsOrders || lifecycleStatus === 'active') {
    return (
      <StatusPill
        label={t('business.lifecycle.active', 'Active')}
        backgroundColor={colors.success.light + '30'}
        textColor={colors.success.dark}
        icon="check-circle"
        compact
        style={style}
      />
    );
  }

  return (
    <StatusPill
      label={t('business.lifecycle.onboarding', 'Onboarding')}
      backgroundColor={colors.pageBackground}
      textColor={colors.text.secondary}
      icon="file-document-outline"
      compact
      style={style}
    />
  );
}
