import React, { useCallback } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { StatusPill } from '@/components/common/StatusPill';
import { formatCurrency } from '@/utils/formatters';
import type {
  ReferredBusinessCommission,
  ReferredBusinessFollowUp,
  ReferredBusinessFollowUpStatus,
} from '@/types/referredBusiness';

interface Props {
  business: ReferredBusinessFollowUp;
}

export function ReferredBusinessCard({ business }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const tone = statusColors(business.followUpStatus, colors);
  const owner = [business.ownerFirstName, business.ownerLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const openTel = useCallback((phone: string) => {
    void Linking.openURL(`tel:${phone}`);
  }, []);
  const openMail = useCallback((email: string) => {
    void Linking.openURL(`mailto:${email}`);
  }, []);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
      }}
    >
      <Text
        variant="titleMedium"
        style={{ color: colors.text.primary, fontWeight: '700' }}
      >
        {business.businessName}
      </Text>
      {owner ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 2 }}
        >
          {owner}
        </Text>
      ) : null}
      <View style={{ marginTop: spacing.sm, gap: 6 }}>
        <StatusPill
          compact
          label={lifecycleLabel(business.lifecycleStatus, t)}
          backgroundColor={tone.backgroundColor}
          textColor={tone.textColor}
        />
        {business.followUpStatus === 'payment_setup_pending' ? (
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t(
              'referrals.followUp.merchantPaymentSetupHint',
              'This shop still needs to finish payment setup.'
            )}
          </Text>
        ) : null}
      </View>
      <CommissionBlock
        commission={business.commission}
        language={i18n.language}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: spacing.sm }}
      >
        {t('referrals.followUp.itemCounts', {
          defaultValue:
            '{{approved}} approved · {{pending}} pending · {{rejected}} rejected',
          approved: business.itemsApproved,
          pending: business.itemsPending,
          rejected: business.itemsRejected,
        })}
      </Text>
      <ContactActions
        phone={business.phone}
        email={business.email}
        onCall={openTel}
        onEmail={openMail}
      />
    </View>
  );
}

function CommissionBlock({
  commission,
  language,
}: {
  commission?: ReferredBusinessCommission;
  language: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  if (!commission) return null;
  const money = (amount: number) =>
    formatCurrency(amount, commission.currency ?? 'XAF', language);
  return (
    <View style={{ marginTop: spacing.sm, gap: 4 }}>
      <CommissionStatusLine commission={commission} money={money} />
      {commission.status === 'pending'
        ? pendingLines(commission, t, money).map((line) => (
            <Text
              key={line}
              variant="bodySmall"
              style={{ color: colors.text.secondary }}
            >
              {line}
            </Text>
          ))
        : null}
    </View>
  );
}

function CommissionStatusLine({
  commission,
  money,
}: {
  commission: ReferredBusinessCommission;
  money: (amount: number) => string;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  if (commission.status === 'paid' && commission.paidAmount != null) {
    const amount = money(commission.paidAmount);
    const date = commission.paidAt
      ? new Date(commission.paidAt).toLocaleDateString(i18n.language)
      : null;
    return (
      <Text variant="bodySmall" style={{ color: colors.success.dark, fontWeight: '600' }}>
        {date
          ? t('referrals.followUp.commissionPaid', {
              defaultValue: 'Commission received: {{amount}} on {{date}}',
              amount,
              date,
            })
          : t('referrals.followUp.commissionPaidNoDate', {
              defaultValue: 'Commission received: {{amount}}',
              amount,
            })}
      </Text>
    );
  }
  if (commission.status === 'window_expired') {
    return (
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'referrals.followUp.commissionWindowExpired',
          'The one-time bonus window has passed. You still earn 1% on completed sales.'
        )}
      </Text>
    );
  }
  return (
    <Text variant="bodySmall" style={{ color: colors.warning.dark, fontWeight: '600' }}>
      {t('referrals.followUp.commissionPending', 'Commission not received yet')}
    </Text>
  );
}

function pendingLines(
  commission: ReferredBusinessCommission,
  t: TFunction,
  money: (amount: number) => string
): string[] {
  const req = commission.requirements;
  const lines: string[] = [];
  if (req.itemsApproved < req.minItems) {
    lines.push(
      t('referrals.followUp.needItems', {
        defaultValue: '{{current}}/{{target}} approved products',
        current: req.itemsApproved,
        target: req.minItems,
      })
    );
  }
  if (req.requiresSale && saleRequirementUnmet(req)) {
    lines.push(saleRequirementLine(req, t, money));
  }
  const days = daysLeft(req.windowEndsAt);
  if (req.requiresSale && days != null) {
    lines.push(
      t('referrals.followUp.daysLeft', {
        defaultValue: '{{count}} days left in the bonus window',
        count: days,
      })
    );
  }
  return lines;
}

function ContactActions({
  phone,
  email,
  onCall,
  onEmail,
}: {
  phone?: string | null;
  email?: string | null;
  onCall: (phone: string) => void;
  onEmail: (email: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  if (!phone && !email) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.sm,
      }}
    >
      {phone ? (
        <Pressable
          onPress={() => onCall(phone)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('referrals.followUp.call', 'Call')}
        >
          <MaterialCommunityIcons name="phone" size={18} color={colors.primary.main} />
          <Text variant="labelLarge" style={{ color: colors.primary.main }}>
            {t('referrals.followUp.call', 'Call')}
          </Text>
        </Pressable>
      ) : null}
      {email ? (
        <Pressable
          onPress={() => onEmail(email)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('referrals.followUp.email', 'Email')}
        >
          <MaterialCommunityIcons
            name="email-outline"
            size={18}
            color={colors.primary.main}
          />
          <Text variant="labelLarge" style={{ color: colors.primary.main }}>
            {t('referrals.followUp.email', 'Email')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function lifecycleLabel(
  lifecycle: string,
  t: (key: string, def: string) => string
): string {
  if (lifecycle === 'created') {
    return t('referrals.followUp.lifecycleCreated', 'Signed up');
  }
  if (lifecycle === 'contract_signed') {
    return t('referrals.followUp.lifecycleContractSigned', 'Contract signed');
  }
  if (lifecycle === 'suspended') {
    return t('referrals.followUp.suspended', 'Suspended');
  }
  return t('referrals.followUp.active', 'Active');
}

function statusColors(
  status: ReferredBusinessFollowUpStatus,
  colors: ReturnType<typeof useTheme>['colors']
): { backgroundColor: string; textColor: string } {
  if (status === 'active') {
    return { backgroundColor: colors.successTint, textColor: colors.success.dark };
  }
  if (status === 'suspended') {
    return { backgroundColor: colors.errorTint, textColor: colors.error.dark };
  }
  return { backgroundColor: colors.warningTint, textColor: colors.warning.dark };
}

function saleRequirementUnmet(
  req: ReferredBusinessCommission['requirements']
): boolean {
  if (req.minSalesTotal > 0) return req.salesTotal < req.minSalesTotal;
  return req.salesTotal <= 0;
}

function saleRequirementLine(
  req: ReferredBusinessCommission['requirements'],
  t: TFunction,
  money: (amount: number) => string
): string {
  if (req.minSalesTotal <= 0) {
    return t('referrals.followUp.needFirstSale', {
      defaultValue: 'Need a completed sale',
    });
  }
  return t('referrals.followUp.needSales', {
    defaultValue: '{{current}} / {{target}} in sales',
    current: money(req.salesTotal),
    target: money(req.minSalesTotal),
  });
}

function daysLeft(windowEndsAt: string | null): number | null {
  if (!windowEndsAt) return null;
  const ms = Date.parse(windowEndsAt) - Date.now();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
