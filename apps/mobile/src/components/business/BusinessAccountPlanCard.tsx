import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import {
  getPlanById,
  type BusinessAccountTypePlan,
} from '../../types/business/accountType';

export interface BusinessAccountPlanCardProps {
  plan: BusinessAccountTypePlan;
  isCurrent: boolean;
  isLocked: boolean;
  onSelect: (plan: BusinessAccountTypePlan) => void;
}

export function BusinessAccountPlanCard({
  plan,
  isCurrent,
  isLocked,
  onSelect,
}: BusinessAccountPlanCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const canSelect = !isCurrent && !isLocked;
  const includesFrom = plan.includesFromId
    ? getPlanById(plan.includesFromId)
    : null;
  const planLabel = t(plan.labelKey, plan.defaultLabel);

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: isCurrent ? plan.color : colors.divider,
          borderWidth: isCurrent ? 2 : 1,
          marginBottom: spacing.md,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[styles.header, { backgroundColor: plan.softColor, padding: spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: plan.color, letterSpacing: 1, marginBottom: 4 }}>
              {'★'.repeat(plan.stars)}
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: plan.color, fontWeight: '800' }}
              numberOfLines={1}
            >
              {planLabel}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {t(plan.taglineKey, plan.defaultTagline)}
            </Text>
          </View>
          {isCurrent ? (
            <StatusPill
              label={t('business.accountType.currentPlan', 'Current Plan')}
              backgroundColor={plan.color}
              textColor={colors.onDark}
              compact
            />
          ) : null}
        </View>
        <Text
          variant="headlineMedium"
          style={{ color: colors.text.primary, fontWeight: '800', marginTop: spacing.sm }}
        >
          {plan.commissionPercent}%
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, fontWeight: '400' }}>
            {' '}
            {t('business.accountType.commissionSuffix', 'commission')}
          </Text>
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {includesFrom ? (
          <Text
            variant="labelMedium"
            style={{ color: plan.color, fontWeight: '700', marginBottom: spacing.sm }}
          >
            {t('business.accountType.everythingIn', 'Everything in {{plan}}, plus:', {
              plan: t(includesFrom.labelKey, includesFrom.defaultLabel),
            })}
          </Text>
        ) : null}
        {plan.defaultBenefits.map((benefit, idx) => (
          <View key={idx} style={[styles.benefitRow, { marginBottom: spacing.xs }]}>
            <MaterialCommunityIcons
              name="check-circle"
              size={18}
              color={plan.color}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
              {t(plan.benefitKeys[idx] ?? '', benefit)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ padding: spacing.md }}>
        {isCurrent ? (
          <Pressable disabled style={styles.currentFooter}>
            <Text variant="labelLarge" style={{ color: plan.color, fontWeight: '700' }}>
              {t('business.accountType.currentPlan', 'Current Plan')}
            </Text>
          </Pressable>
        ) : (
          <Button
            mode="contained"
            disabled={!canSelect}
            onPress={() => onSelect(plan)}
            buttonColor={plan.color}
            textColor={colors.onDark}
          >
            {isLocked
              ? t('business.accountType.planLocked', 'Locked')
              : t('business.accountType.selectPlan', 'Select {{plan}}', {
                  plan: planLabel,
                })}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  header: {},
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  currentFooter: { alignItems: 'center', paddingVertical: 8 },
});
