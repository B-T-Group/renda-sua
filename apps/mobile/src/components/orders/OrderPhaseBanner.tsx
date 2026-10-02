import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import {
  formatPayByTime,
  payAfterPayByDeadline,
  payByUrgency,
  splitAroundTime,
} from '../../utils/payAfterConfirm';
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
    is_cooked_food_pickup?: boolean | null;
    pay_after_merchant_confirm?: boolean | null;
    fulfillment_timing?: string | null;
    delivery_time_windows?: unknown[] | null;
    order_items?: unknown[] | null;
    order_status_history?: Array<{ status?: string | null; created_at: string }> | null;
  };
  role: OrderPhaseRole;
  action?: React.ReactNode;
}

export function OrderPhaseBanner({ order, role, action }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const info = resolveOrderPhase(orderToPhaseInput(order), role);
  const pc = phaseColors(info.phase, colors);
  const payByDeadline = role === 'client' ? payAfterPayByDeadline(order as any) : null;
  const [now, setNow] = useState(() => new Date());
  const hasPayBy = payByDeadline != null;

  // Re-evaluate the warning / expired state while the pay-by line is visible.
  useEffect(() => {
    if (!hasPayBy) return undefined;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [hasPayBy]);

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
      {payByDeadline ? (
        <PayByLine deadline={payByDeadline} now={now} language={i18n.language} />
      ) : null}
      {action}
    </View>
  );
}

function PayByLine({
  deadline,
  now,
  language,
}: {
  deadline: Date;
  now: Date;
  language: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const urgency = payByUrgency(deadline, now);

  if (urgency === 'expired') {
    const expiredText = t(
      'orders.payAfterConfirm.payByExpired',
      'The payment window has ended. This order will be cancelled automatically and you will not be charged.'
    );
    return (
      <View style={[styles.payByRow, { gap: spacing.xs }]} accessible accessibilityLabel={expiredText}>
        <MaterialCommunityIcons name="clock-alert-outline" size={18} color={colors.error.main} />
        <Text style={[typography.body2, styles.payByText, { color: colors.error.main, fontWeight: '600' }]}>
          {expiredText}
        </Text>
      </View>
    );
  }

  const time = formatPayByTime(
    deadline,
    language,
    now,
    t('orders.payAfterConfirm.tomorrow', 'tomorrow')
  );
  const text = t(
    'orders.payAfterConfirm.payBy',
    "Pay by {{time}}. You haven't been charged yet. If you miss it, the order is cancelled and nothing is charged.",
    { time, interpolation: { escapeValue: false } }
  );
  const parts = splitAroundTime(text, time);
  const color = urgency === 'urgent' ? colors.warning.dark ?? colors.warning.main : colors.text.primary;
  return (
    <View style={[styles.payByRow, { gap: spacing.xs }]} accessible accessibilityLabel={text}>
      <MaterialCommunityIcons name="clock-outline" size={18} color={color} />
      <Text style={[typography.body2, styles.payByText, { color }]}>
        {parts ? (
          <>
            {parts.before}
            <Text style={{ fontWeight: '800', color }}>{parts.time}</Text>
            {parts.after}
          </>
        ) : (
          text
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  payByRow: { flexDirection: 'row', alignItems: 'flex-start' },
  payByText: { flex: 1, minWidth: 0 },
  box: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
