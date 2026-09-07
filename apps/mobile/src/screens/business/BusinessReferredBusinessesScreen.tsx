import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { BusinessReferralCodeCard } from '../../components/business/BusinessReferralCodeCard';
import { ReferredBusinessesList } from '../../components/referrals/ReferredBusinessesList';
import { useBusinessReferrals } from '../../hooks/useBusinessReferrals';

export default function BusinessReferredBusinessesScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { businesses, loading, error } = useBusinessReferrals(true, true);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text variant="bodyLarge" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
        {t(
          'business.referrals.followUpIntro',
          'Share your code, then follow up with businesses you referred.'
        )}
      </Text>
      <BusinessReferralCodeCard showFollowUpCta={false} />
      <Text
        variant="titleMedium"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginTop: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        {t('referrals.followUp.listTitle', 'Referred businesses')}
      </Text>
      <ReferredBusinessesList
        businesses={businesses}
        loading={loading}
        error={error}
      />
    </ScrollView>
  );
}
