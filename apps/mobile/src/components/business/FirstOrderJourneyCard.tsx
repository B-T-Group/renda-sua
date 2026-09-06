import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { OrderJourneyIllustration } from '../illustrations/OrderJourneyIllustrations';
import type { FirstOrderJourneyStep, FirstOrderJourneyView } from '../../utils/firstOrderJourney';

export interface FirstOrderJourneyCardProps {
  journey: FirstOrderJourneyView;
}

function StepRow({
  step,
  stepNumber,
}: {
  step: FirstOrderJourneyStep;
  stepNumber: number;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const isCurrent = step.state === 'current';
  const isDone = step.state === 'done';

  if (!isCurrent && step.state === 'upcoming') {
    return (
      <View style={[styles.stepRow, { gap: spacing.sm, opacity: 0.55 }]}>
        <View
          style={[
            styles.stepBadge,
            {
              borderColor: colors.divider,
              backgroundColor: colors.background.paper,
            },
          ]}
        >
          <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
            {stepNumber}
          </Text>
        </View>
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.secondary, flex: 1, minWidth: 0 }}
          numberOfLines={2}
        >
          {t(step.titleKey, step.titleDefault)}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.stepBlock,
        {
          borderColor: isCurrent ? colors.primary.main + '55' : colors.divider,
          backgroundColor: isCurrent
            ? colors.primaryTint ?? colors.primary.main + '12'
            : colors.background.paper,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={[styles.stepRow, { gap: spacing.sm }]}>
        <View
          style={[
            styles.stepBadge,
            {
              borderColor: isDone ? colors.success.main : colors.primary.main,
              backgroundColor: isDone
                ? colors.success.main + '22'
                : colors.primaryTint ?? colors.primary.main + '22',
            },
          ]}
        >
          {isDone ? (
            <MaterialCommunityIcons
              name="check"
              size={16}
              color={colors.success.main}
            />
          ) : (
            <Text
              variant="labelMedium"
              style={{ color: colors.primary.main, fontWeight: '700' }}
            >
              {stepNumber}
            </Text>
          )}
        </View>
        <Text
          variant="titleSmall"
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            flex: 1,
            minWidth: 0,
          }}
        >
          {t(step.titleKey, step.titleDefault)}
        </Text>
      </View>
      {isCurrent ? (
        <>
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            <Text style={{ fontWeight: '700' }}>
              {t('business.firstOrder.youDoLabel', 'You:')}{' '}
            </Text>
            {t(step.youDoKey, step.youDoDefault)}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            <Text style={{ fontWeight: '700' }}>
              {t('business.firstOrder.rendasuaLabel', 'Rendasua:')}{' '}
            </Text>
            {t(step.rendasuaKey, step.rendasuaDefault)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

export function FirstOrderJourneyCard({ journey }: FirstOrderJourneyCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const currentStep = useMemo(
    () => journey.steps.find((step) => step.state === 'current') ?? journey.steps[0],
    [journey.steps]
  );

  const isSuccess = journey.isSuccess;
  const headerTitle = isSuccess
    ? t('business.firstOrder.successTitle', 'First order complete!')
    : t('business.firstOrder.title', 'Your first order');
  const headerBody = isSuccess
    ? t(
        'business.firstOrder.successBody',
        'You successfully fulfilled your first sale on Rendasua.'
      )
    : t(
        'business.firstOrder.subtitle',
        "Here's exactly what to do — one step at a time."
      );

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: isSuccess ? colors.success.main + '55' : colors.info.main + '55',
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.header}>
        <OrderJourneyIllustration
          id={currentStep?.illustrationId ?? 'received'}
          size={72}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {headerTitle}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {headerBody}
          </Text>
        </View>
      </View>
      {!isSuccess && journey.currentStepId !== 'cancelled' ? (
        <View style={{ gap: spacing.sm }}>
          {journey.steps.map((step, index) => (
            <StepRow key={step.id} step={step} stepNumber={index + 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBlock: {
    borderWidth: 1,
  },
});
