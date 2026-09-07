import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { PickupRunningLateIllustration } from '../illustrations/PickupRunningLateIllustration';

function PickupReminderOverlayBase() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { pickupReminder } = useStore();
  const payload = pickupReminder.payload;

  return (
    <Modal
      visible={pickupReminder.visible}
      transparent
      animationType="fade"
      onRequestClose={() => pickupReminder.dismiss()}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={() => pickupReminder.dismiss()}
      >
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
          <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
            <PickupRunningLateIllustration />
          </View>
          <Text
            style={[
              typography.subheading,
              { color: colors.text.primary, textAlign: 'center' },
            ]}
          >
            {payload?.title ||
              t('agent.orders.detail.pickupReminderTitle', 'Pickup reminder')}
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
              {t('agent.orders.detail.pickupReminderOrder', 'Order #{{orderNumber}}', {
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
            {payload?.body ?? ''}
          </Text>
          <View style={{ marginTop: spacing.lg }}>
            <Button mode="contained" onPress={() => pickupReminder.dismiss()}>
              {t('common.gotIt', 'Got it')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const PickupReminderOverlay = observer(PickupReminderOverlayBase);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%' },
});
