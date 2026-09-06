import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import {
  resolveOrderPhase,
  orderToPhaseInput,
  type OrderPhase,
  type OrderPhaseRole,
} from '../../utils/orderPhase';

const PHASE_DEFAULTS: Record<string, string> = {
  'orders.phases.pay': 'Payment needed',
  'orders.phases.confirm': 'Awaiting confirmation',
  'orders.phases.prepare': 'Preparing',
  'orders.phases.ready': 'Ready',
  'orders.phases.inDelivery': 'In delivery',
  'orders.phases.done': 'Done',
};

function phaseColors(
  phase: OrderPhase,
  colors: ReturnType<typeof useTheme>['colors']
) {
  switch (phase) {
    case 'pay':
    case 'confirm':
      return {
        backgroundColor: colors.warning.main + '22',
        textColor: colors.warning.dark ?? colors.warning.main,
        borderColor: colors.warning.main + '55',
      };
    case 'prepare':
    case 'ready':
    case 'in_delivery':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
      };
    default:
      return {
        backgroundColor: colors.info.main + '18',
        textColor: colors.info.main,
        borderColor: colors.info.main + '44',
      };
  }
}

interface Props {
  order: {
    current_status?: string | null;
    fulfillment_method?: string | null;
    payment_timing?: string | null;
    payment_status?: string | null;
    payment_method?: string | null;
    assigned_agent_id?: string | null;
    reconciliation_status?: string | null;
  };
  role: OrderPhaseRole;
  action?: React.ReactNode;
}

export function OrderPhaseBanner({ order, role, action }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const info = resolveOrderPhase(orderToPhaseInput(order), role);
  const pc = phaseColors(info.phase, colors);

  // Complete orders already show status on the hero; the next-step alert adds noise.
  if (order.current_status === 'complete') {
    return null;
  }

  return (
    <View
      style={[
        styles.box,
        {
          borderColor: colors.info.main + '55',
          backgroundColor: colors.info.main + '14',
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
      ]}
      accessibilityRole="text"
    >
      <View style={styles.row}>
        <StatusPill
          label={t(info.labelKey, PHASE_DEFAULTS[info.labelKey] ?? info.phase)}
          backgroundColor={pc.backgroundColor}
          textColor={pc.textColor}
          borderColor={pc.borderColor}
        />
        <Text
          style={[
            typography.caption,
            { color: colors.info.main, fontWeight: '700', marginLeft: spacing.sm },
          ]}
        >
          {t('orders.nextStep.label', 'Next step')}
        </Text>
      </View>
      {info.nextStepKey ? (
        <Text style={[typography.body2, { color: colors.text.primary }]}>
          {t(info.nextStepKey, '')}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
