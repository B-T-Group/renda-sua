import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi } from '../../services/agentApi';
import type { Order } from '../../types/agent';
import { NoCourierFoundIllustration } from '../illustrations/NoCourierFoundIllustration';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';

interface Props {
  visible: boolean;
  order: Order;
  onDismiss: () => void;
  /** Order has been switched to pickup; caller should refetch and close. */
  onSwitchedToPickup: () => void;
  /** User chose to cancel instead; caller opens the existing cancellation sheet. */
  onCancelInstead: () => void;
}

/**
 * Shown when agent dispatch escalated through both radius rounds without a
 * claim (`order.dispatch_exhausted_at` set). Offers the client a way forward:
 * switch to store pickup (delivery fee waived) or cancel the order.
 */
export function NoAgentOptionsSheet({
  visible,
  order,
  onDismiss,
  onSwitchedToPickup,
  onCancelInstead,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleDismiss = useCallback(() => {
    if (submitting) return;
    setSubmitError(null);
    onDismiss();
  }, [submitting, onDismiss]);

  const handleSwitchToPickup = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await agentApi.orders.switchToPickup({ orderId: order.id });
      if (res.success) {
        onSwitchedToPickup();
      } else {
        setSubmitError(
          res.message ?? t('orderActions.switchToPickupFailed', 'Could not switch to store pickup.')
        );
      }
    } catch (e: unknown) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : t('orderActions.switchToPickupFailed', 'Could not switch to store pickup.')
      );
    } finally {
      setSubmitting(false);
    }
  }, [order.id, onSwitchedToPickup, t]);

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={[
          styles.modal,
          {
            width,
            maxHeight: height - insets.top - 32,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
            <NoCourierFoundIllustration />
          </View>

          <Text variant="titleLarge" style={{ textAlign: 'center', marginBottom: spacing.xs }}>
            {t('orders.noAgent.title', "We couldn't find a nearby courier")}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.lg }}
          >
            {t(
              'orders.noAgent.description',
              "Order #{{orderNumber}} is ready, but no delivery agent has picked it up yet. You can switch to store pickup with the delivery fee waived, or cancel the order.",
              { orderNumber: order.order_number }
            )}
          </Text>

          {submitError ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.error.main, marginBottom: spacing.md, textAlign: 'center' }}
            >
              {submitError}
            </Text>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Button
              mode="contained"
              icon="storefront-outline"
              onPress={() => void handleSwitchToPickup()}
              disabled={submitting}
            >
              {t('orders.noAgent.switchToPickup', 'Switch to store pickup (fee waived)')}
            </Button>
            <Button
              mode="outlined"
              textColor={colors.error.main}
              icon="close-circle-outline"
              onPress={onCancelInstead}
              disabled={submitting}
            >
              {t('orderActions.cancelOrder', 'Cancel order')}
            </Button>
            <Button mode="text" onPress={handleDismiss} disabled={submitting}>
              {t('orders.noAgent.decideLater', "I'll decide later")}
            </Button>
          </View>
        </ScrollView>
      </Modal>

      <ActionLoadingDialog
        visible={submitting}
        action="ready_for_pickup"
        message={t('orders.noAgent.switching', 'Switching to store pickup…')}
      />
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
});
