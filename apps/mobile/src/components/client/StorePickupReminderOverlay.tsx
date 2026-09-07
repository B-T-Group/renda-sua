import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { rootNavigationRef } from '../../navigation/rootNavigationRef';
import { agentApi } from '../../services/agentApi';
import type { Order } from '../../types/agent';
import { CancellationConfirmSheet } from '../client/CancellationConfirmSheet';

function StorePickupReminderOverlayBase() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { storePickupReminder } = useStore();
  const payload = storePickupReminder.payload;
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    if (!storePickupReminder.visible || !payload?.orderId) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    setLoadingOrder(true);
    void agentApi.orders
      .getById(payload.orderId)
      .then((loaded) => {
        if (!cancelled) setOrder(loaded);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrder(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payload?.orderId, storePickupReminder.visible]);

  const onMessage = () => {
    if (!payload?.orderId) return;
    const draft = t(
      'orders.storePickupReminder.draftMessage',
      "Hi! Just confirming I'm still coming to pick up order {{orderNumber}}. See you soon.",
      { orderNumber: payload.orderNumber || order?.order_number || '' }
    );
    storePickupReminder.dismiss();
    if (!rootNavigationRef.isReady()) return;
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'OrderMessages',
        params: { orderId: payload.orderId, draftMessage: draft },
      })
    );
  };

  return (
    <>
      <Modal
        visible={storePickupReminder.visible}
        transparent
        animationType="fade"
        onRequestClose={() => storePickupReminder.dismiss()}
        statusBarTranslucent
      >
        <Pressable style={styles.scrim} onPress={() => storePickupReminder.dismiss()}>
          <Pressable
            style={[
              styles.sheet,
              shadows.md,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.xl,
                maxHeight: height * 0.85,
                paddingBottom: insets.bottom + spacing.md,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={[
                typography.subheading,
                { color: colors.text.primary, textAlign: 'center' },
              ]}
            >
              {payload?.title ||
                t('orders.storePickupReminder.title', 'Your order is waiting')}
            </Text>
            {payload?.orderNumber ? (
              <Text
                style={[
                  typography.body2,
                  {
                    color: colors.text.secondary,
                    marginTop: spacing.xs,
                    textAlign: 'center',
                  },
                ]}
              >
                {t('orders.orderNumber', 'Order #{{orderNumber}}', {
                  orderNumber: payload.orderNumber,
                })}
              </Text>
            ) : null}
            <Text
              style={[
                typography.body1,
                {
                  color: colors.text.primary,
                  marginTop: spacing.md,
                  textAlign: 'center',
                },
              ]}
            >
              {payload?.body ||
                t(
                  'orders.storePickupReminder.body',
                  'This store pickup order is still ready. Message the business to let them know you are coming, or cancel if you can no longer collect it.'
                )}
            </Text>
            {loadingOrder ? (
              <ActivityIndicator style={{ marginTop: spacing.md }} />
            ) : null}
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button mode="contained" onPress={onMessage}>
                {t(
                  'orders.storePickupReminder.messageBusiness',
                  'Message the business'
                )}
              </Button>
              <Button
                mode="outlined"
                textColor={colors.error}
                onPress={() => storePickupReminder.openCancel()}
                disabled={!order}
              >
                {t('orders.storePickupReminder.cancelOrder', 'Cancel order')}
              </Button>
              <Button mode="text" onPress={() => storePickupReminder.dismiss()}>
                {t('common.close', 'Close')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {order ? (
        <CancellationConfirmSheet
          visible={storePickupReminder.showCancel}
          order={order}
          onDismiss={() => storePickupReminder.closeCancel()}
          onSuccess={() => storePickupReminder.dismiss()}
        />
      ) : null}
    </>
  );
}

export const StorePickupReminderOverlay = observer(StorePickupReminderOverlayBase);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%' },
});
