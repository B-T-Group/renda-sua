import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { DeliveryConfirmationState } from '../../types/deliveryConfirmation';
import { agentWaitingCopy } from '../../utils/deliveryConfirmationUi';

type Props = {
  state: DeliveryConfirmationState;
  payAtDeliveryPaid?: boolean;
};

export function AgentWaitingForClientCard({ state, payAtDeliveryPaid }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const waiting = agentWaitingCopy(state.agentMessageKey);
  const hours = state.autoCompleteHours || 2;

  const body =
    state.status === 'pending_auto_complete'
      ? t('orders.clientConfirm.agentFallbackDone', {
          defaultValue:
            'Submitted. Order completes automatically in {{h}}h unless the client reports a problem.',
          h: hours,
        })
      : payAtDeliveryPaid
        ? t(
            'orders.clientConfirm.payReceivedNext',
            'Payment received. Ask the client to confirm receipt in the app.'
          )
        : t(waiting.i18nKey, waiting.fallback);

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <Text style={[{ color: colors.text.primary }, typography.body1]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
