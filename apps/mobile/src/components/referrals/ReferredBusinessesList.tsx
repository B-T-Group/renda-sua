import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ReferredBusinessCard } from './ReferredBusinessCard';
import type { ReferredBusinessFollowUp } from '@/types/referredBusiness';

interface Props {
  businesses: ReferredBusinessFollowUp[];
  loading?: boolean;
  error?: string | null;
}

export function ReferredBusinessesList({ businesses, loading, error }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (loading) {
    return (
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t('common.loading', 'Loading...')}
      </Text>
    );
  }

  if (error) {
    return (
      <Text variant="bodyMedium" style={{ color: colors.error.main }}>
        {t(
          'referrals.followUp.loadError',
          'Could not load referred businesses. Try again.'
        )}
      </Text>
    );
  }

  if (businesses.length === 0) {
    return (
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {t(
          'referrals.followUp.empty',
          'No referred businesses yet. Share your code to get started.'
        )}
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {businesses.map((biz) => (
        <ReferredBusinessCard key={biz.businessId} business={biz} />
      ))}
    </View>
  );
}
