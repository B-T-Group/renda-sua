import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  isDisabled: boolean;
  isDismissLocked: boolean;
  isConfirming: boolean;
  isSlotPast: boolean;
  extraPrepMinutes: number | null;
  fulfillmentMethod?: string | null;
  /** Cooked-food MoMo: payment request is sent when the merchant confirms. */
  payAfterMerchantConfirm?: boolean;
  onConfirm: () => void;
  onBusy: () => void;
  onDismiss: () => void;
  onDecline: () => void;
}

function confirmHintForFulfillment(
  fulfillmentMethod: string | null | undefined,
  payAfterMerchantConfirm: boolean | undefined,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (payAfterMerchantConfirm) {
    return t(
      'incomingOrder.confirmHintPayAfterConfirm',
      'Once you confirm, the customer will receive a Mobile Money payment request. Wait until they pay before you start preparing.'
    );
  }
  if (fulfillmentMethod === 'pickup') {
    return t(
      'incomingOrder.confirmHintPickup',
      'The customer will be notified. You will then prepare the order and mark it ready for in-store pickup.'
    );
  }
  if (fulfillmentMethod === 'shipping') {
    return t(
      'incomingOrder.confirmHintShipping',
      'The customer will be notified. You will then prepare the order and mark it shipped when ready.'
    );
  }
  return t(
    'incomingOrder.confirmHint',
    'The customer will be notified. You will then prepare the order and mark it ready — a courier is not sent until then.'
  );
}

function busyCaption(
  extraPrepMinutes: number | null,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (extraPrepMinutes != null) {
    return t(
      'incomingOrder.busyHintAdded',
      '+{{min}} min already added · we’ll remind you again.',
      { min: extraPrepMinutes }
    );
  }
  return t('incomingOrder.busyHint', 'We’ll remind you in 15 minutes.');
}

function BusyBlock({
  extraPrepMinutes,
  isDisabled,
  onBusy,
}: {
  extraPrepMinutes: number | null;
  isDisabled: boolean;
  onBusy: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const caption = busyCaption(extraPrepMinutes, t);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('incomingOrder.busyQuestion', 'Busy right now?')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {caption}
      </Text>
      <Button
        mode="outlined"
        onPress={onBusy}
        disabled={isDisabled}
        icon="clock-outline"
        accessibilityLabel={t(
          'incomingOrder.busy',
          'Busy right now — need more time'
        )}
      >
        {t('incomingOrder.busyAction', 'Need more time')}
      </Button>
    </View>
  );
}

function ConfirmableActions({
  isDisabled,
  isDismissLocked,
  isConfirming,
  extraPrepMinutes,
  fulfillmentMethod,
  payAfterMerchantConfirm,
  onConfirm,
  onBusy,
  onDismiss,
  onDecline,
}: Omit<Props, 'isSlotPast'>) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Button
        mode="contained"
        onPress={onConfirm}
        disabled={isDisabled}
        loading={isConfirming}
        contentStyle={{ paddingVertical: 4 }}
        labelStyle={{ fontSize: 16 }}
        icon="check-circle-outline"
      >
        {t('incomingOrder.confirm', 'Confirm order')}
      </Button>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {confirmHintForFulfillment(
          fulfillmentMethod,
          payAfterMerchantConfirm,
          t
        )}
      </Text>
      <BusyBlock
        extraPrepMinutes={extraPrepMinutes}
        isDisabled={isDisabled}
        onBusy={onBusy}
      />
      <Button
        mode="text"
        onPress={onDismiss}
        disabled={isDismissLocked}
        icon="arrow-left"
      >
        {t('incomingOrder.dismiss', 'Review later')}
      </Button>
      <Button
        mode="text"
        onPress={onDecline}
        disabled={isDisabled}
        textColor={colors.error.main}
        icon="close-circle-outline"
      >
        {t('incomingOrder.decline', 'Cancel order')}
      </Button>
    </View>
  );
}

function PastSlotActions({
  isDisabled,
  onDecline,
}: {
  isDisabled: boolean;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Button
      mode="contained"
      onPress={onDecline}
      disabled={isDisabled}
      buttonColor={colors.error.main}
      icon="close-circle-outline"
    >
      {t('incomingOrder.decline', 'Cancel order')}
    </Button>
  );
}

export function IncomingOrderActions(props: Props) {
  if (props.isSlotPast) {
    return (
      <PastSlotActions
        isDisabled={props.isDisabled}
        onDecline={props.onDecline}
      />
    );
  }
  return <ConfirmableActions {...props} />;
}
