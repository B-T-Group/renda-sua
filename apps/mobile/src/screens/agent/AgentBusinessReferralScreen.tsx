import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { AgentReferralCodeCard } from '../../components/profile/AgentReferralCodeCard';
import { BusinessReferralCommissionVector } from '../../components/illustrations/BusinessReferralCommissionVector';
import { BusinessReferralSupportVector } from '../../components/illustrations/BusinessReferralSupportVector';
import { useAgentReferredBusinesses } from '../../hooks/useAgentReferredBusinesses';
import { useAgentCode } from '../../hooks/useAgentCode';
import { ReferredBusinessesList } from '../../components/referrals/ReferredBusinessesList';
import { RecruitmentTipsSection } from '../../components/referrals/RecruitmentTipsSection';
import { BusinessReferralPayoutsSection } from '../../components/referrals/BusinessReferralPayoutsSection';
import { useStore } from '../../stores/RootStore';
import { useUserCurrency } from '../../hooks/useUserCurrency';
import {
  businessReferralPayoutSchedule,
  payoutCountryCode,
} from '../../utils/businessReferralPayoutSchedule';

function BenefitCard({
  title,
  body,
  illustration,
}: {
  title: string;
  body: string;
  illustration: React.ReactNode;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      {illustration}
      <Text
        variant="titleMedium"
        style={{ color: colors.text.primary, fontWeight: '700', marginTop: spacing.sm }}
      >
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 6 }}>
        {body}
      </Text>
    </View>
  );
}

export default function AgentBusinessReferralScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { market } = useStore();
  const { country: accountCountry } = useUserCurrency();
  const schedule = businessReferralPayoutSchedule(
    payoutCountryCode(accountCountry, market.selectedCountryCode)
  );
  const hasMinSales = schedule.catalog10MinSaleTotal > 0;
  const {
    count,
    agentCode: summaryCode,
    businesses,
    loading,
    error,
  } = useAgentReferredBusinesses(true, true);
  const { agentCode: meCode } = useAgentCode();
  const agentCode = summaryCode ?? meCode;
  const referredCount = count ?? 0;

  const renderCode = useCallback(() => {
    if (!agentCode) {
      return (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t(
            'agent.businessReferrals.codeUnavailable',
            'Your referral code will appear here once your agent profile is ready.'
          )}
        </Text>
      );
    }
    return <AgentReferralCodeCard agentCode={agentCode} />;
  }, [agentCode, colors.text.secondary, t]);

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
      <Text variant="bodyLarge" style={{ color: colors.text.secondary }}>
        {t(
          'agent.businessReferrals.pageIntro',
          'Grow your income by helping local businesses join Rendasua and succeed.'
        )}
      </Text>

      <View
        style={[
          styles.statRow,
          {
            marginTop: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: colors.primaryTint,
            borderRadius: 12,
            padding: spacing.md,
          },
        ]}
      >
        <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
          {t('agent.businessReferrals.statLabel', 'Referred so far')}
        </Text>
        <Text
          variant="headlineMedium"
          style={{ color: colors.primary.main, fontWeight: '700', marginTop: 2 }}
        >
          {loading ? '…' : referredCount.toLocaleString()}
        </Text>
      </View>

      <BenefitCard
        title={t('agent.businessReferrals.benefitTitle', 'Your benefit')}
        body={t(
          hasMinSales
            ? 'agent.businessReferrals.benefitBodyWithMinSales'
            : 'agent.businessReferrals.benefitBody',
          hasMinSales
            ? 'You earn a one-time bonus when they list 10 products and reach the minimum sales total within 30 days, plus 1% on every completed sale.'
            : 'You earn a one-time bonus when they list 10 products and complete a sale within 30 days, plus 1% on every completed sale.'
        )}
        illustration={<BusinessReferralCommissionVector size={128} />}
      />

      <BusinessReferralPayoutsSection />

      <BenefitCard
        title={t('agent.businessReferrals.responsibilityTitle', 'Your responsibility')}
        body={t(
          'agent.businessReferrals.responsibilityBody',
          'Accompany them through onboarding: help add products, set up their account until it is fully operational, and stay available when they need you.'
        )}
        illustration={<BusinessReferralSupportVector size={128} />}
      />

      <Text
        variant="titleMedium"
        style={{ color: colors.text.primary, fontWeight: '700', marginBottom: spacing.sm }}
      >
        {t('agent.businessReferrals.shareCodeTitle', 'Share your code')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
        {t(
          'agent.businessReferrals.shareCodeBody',
          'Businesses enter this code when they sign up so the referral is linked to you.'
        )}
      </Text>
      {renderCode()}

      <RecruitmentTipsSection />

      <Text
        variant="titleMedium"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginTop: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        {t('agent.businessReferrals.statLabel', 'Referred so far')}
      </Text>
      <ReferredBusinessesList
        businesses={businesses}
        loading={loading}
        error={error}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  statRow: {
    alignItems: 'flex-start',
  },
});
