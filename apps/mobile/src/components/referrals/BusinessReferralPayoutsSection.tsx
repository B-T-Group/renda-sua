import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { formatCurrency } from '@/utils/formatters';
import {
  businessReferralPayoutSchedule,
  payoutCountryCode,
  type BusinessReferralPayoutSchedule,
} from '@/utils/businessReferralPayoutSchedule';
import {
  Catalog10PayoutVector,
  SalePercentPayoutVector,
} from '@/components/illustrations/BusinessReferralPayoutVectors';

export const BusinessReferralPayoutsSection = observer(
  function BusinessReferralPayoutsSection() {
    const { t, i18n } = useTranslation();
    const { market } = useStore();
    const { country: accountCountry } = useUserCurrency();
    const { colors, spacing } = useTheme();
    const schedule = businessReferralPayoutSchedule(
      payoutCountryCode(accountCountry, market.selectedCountryCode)
    );
    const money = (amount: number) =>
      formatCurrency(amount, schedule.currency, i18n.language);
    return (
      <View style={{ marginBottom: spacing.md }}>
        <PayoutsHeading t={t} schedule={schedule} />
        {payoutRows(t, money, schedule).map((row) => (
          <PayoutCard key={row.key} row={row} />
        ))}
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 4 }}
        >
          {t(
            'agent.businessReferrals.payouts.onceNote',
            'The {{amount}} bonus is paid only once per shop. 1% is paid on every completed sale, including the sale that unlocks the bonus.',
            { amount: money(schedule.catalog10Amount) }
          )}
        </Text>
      </View>
    );
  }
);

function PayoutsHeading({
  t,
  schedule,
}: {
  t: TFunction;
  schedule: BusinessReferralPayoutSchedule;
}) {
  const { colors, spacing } = useTheme();
  const intro =
    schedule.catalog10MinSaleTotal > 0
      ? t(
          'agent.businessReferrals.payouts.sectionIntroWithMinSales',
          'A one-time bonus when they list 10 products and reach the minimum sales total within 30 days of joining, plus 1% on every completed sale.'
        )
      : t(
          'agent.businessReferrals.payouts.sectionIntro',
          'A one-time bonus when they list 10 products and complete a sale within 30 days of joining, plus 1% on every completed sale.'
        );
  return (
    <>
      <Text
        variant="titleMedium"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginBottom: spacing.sm,
        }}
      >
        {t('agent.businessReferrals.payouts.sectionTitle', 'How you get paid')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {intro}
      </Text>
    </>
  );
}

function PayoutCard({
  row,
}: {
  row: ReturnType<typeof payoutRows>[number];
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {row.illustration}
      <Text
        variant="titleSmall"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginTop: spacing.sm,
        }}
      >
        {row.title}
      </Text>
      <Text
        variant="titleSmall"
        style={{ color: colors.success.main, fontWeight: '700', marginTop: 4 }}
      >
        {row.amount}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginTop: 6 }}
      >
        {row.body}
      </Text>
    </View>
  );
}

function catalog10Copy(
  t: TFunction,
  money: (amount: number) => string,
  schedule: BusinessReferralPayoutSchedule
) {
  const amount = money(schedule.catalog10Amount);
  const minSales = money(schedule.catalog10MinSaleTotal);
  if (schedule.catalog10MinSaleTotal > 0) {
    return {
      title: t(
        'agent.businessReferrals.payouts.catalog10TitleWithMinSales',
        '10 approved products + {{minSales}} in sales in 30 days',
        { minSales }
      ),
      body: t(
        'agent.businessReferrals.payouts.catalog10BodyWithMinSales',
        'When the shop has at least 10 approved products and at least {{minSales}} in completed sales within 30 days of joining, you receive {{amount}} once.',
        { amount, minSales }
      ),
    };
  }
  return {
    title: t(
      'agent.businessReferrals.payouts.catalog10Title',
      '10 approved products + a sale in 30 days'
    ),
    body: t(
      'agent.businessReferrals.payouts.catalog10Body',
      'When the shop has at least 10 approved products and completes a sale within 30 days of joining, you receive {{amount}} once.',
      { amount }
    ),
  };
}

function payoutRows(
  t: TFunction,
  money: (amount: number) => string,
  schedule: BusinessReferralPayoutSchedule
) {
  const pct = String(schedule.salePercent);
  const catalog10 = catalog10Copy(t, money, schedule);
  return [
    {
      key: 'catalog10',
      illustration: <Catalog10PayoutVector />,
      title: catalog10.title,
      amount: money(schedule.catalog10Amount),
      body: catalog10.body,
    },
    {
      key: 'percent',
      illustration: <SalePercentPayoutVector />,
      title: t('agent.businessReferrals.payouts.percentTitle', 'Every completed sale'),
      amount: t(
        'agent.businessReferrals.payouts.percentAmount',
        '{{percent}}% of the sale',
        { percent: pct }
      ),
      body: t(
        'agent.businessReferrals.payouts.percentBody',
        'You also earn {{percent}}% of every completed sale, including the sale that pays the one-time bonus.',
        { percent: pct }
      ),
    },
  ];
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    alignItems: 'center',
  },
});
