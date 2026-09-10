import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export interface ForfeitDepositCancelDialogProps {
  visible: boolean;
  mode: 'out_for_delivery' | 'ready_for_pickup';
  depositAmount: number;
  currency: string;
  onKeep: () => void;
  onCancelAndForfeit: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

/**
 * Forfeit deposit cancel confirmation dialog.
 * Shown when user tries to cancel an order that is:
 * - Out for delivery (delivery orders)
 * - Ready for pickup (pickup orders)
 *
 * Warns the user that cancelling now means forfeiting the reservation deposit.
 */
export function ForfeitDepositCancelDialog({
  visible,
  mode,
  depositAmount,
  currency,
  onKeep,
  onCancelAndForfeit,
  onDismiss,
  loading = false,
}: ForfeitDepositCancelDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const title =
    mode === 'out_for_delivery'
      ? t('deposit.forfeit.outForDeliveryTitle', 'Cancel while out for delivery?')
      : t('deposit.forfeit.readyForPickupTitle', 'Cancel after ready for pickup?');

  const message =
    mode === 'out_for_delivery'
      ? t(
          'deposit.forfeit.outForDeliveryMessage',
          'Your order is already on the way. Cancelling or refusing now means you lose the reservation deposit.'
        )
      : t(
          'deposit.forfeit.readyForPickupMessage',
          'Your order is ready at the store. Cancelling or not showing up now means you lose the reservation deposit.'
        );

  const primaryCta =
    mode === 'out_for_delivery'
      ? t('deposit.forfeit.keepOrderCta', 'Keep my order')
      : t('deposit.forfeit.pickUpCta', 'I will pick it up');

  const dangerCta = t('deposit.forfeit.cancelAndForfeitCta', 'Cancel and forfeit {{amount}} {{currency}}', {
    amount: depositAmount,
    currency,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.large,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: screenHeight * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { padding: spacing.lg }]}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.error.light,
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.error.main} />
            </View>
            <Text variant="titleLarge" style={[typography.h6, { textAlign: 'center', marginBottom: spacing.sm }]}>
              {title}
            </Text>
            <Text
              variant="bodyMedium"
              style={[typography.body1, { color: colors.text.secondary, textAlign: 'center' }]}
            >
              {message}
            </Text>
          </View>

          <View
            style={[
              styles.forfeitBox,
              {
                backgroundColor: colors.pageBackground,
                borderColor: colors.error.main,
                borderWidth: 1,
                borderLeftWidth: 4,
                marginHorizontal: spacing.lg,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text
              variant="labelSmall"
              style={[
                typography.caption,
                {
                  color: colors.error.main,
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  marginBottom: 4,
                },
              ]}
            >
              {mode === 'out_for_delivery'
                ? t('deposit.forfeit.outForDeliveryForfeitAmount', 'Deposit forfeited')
                : t('deposit.forfeit.readyForPickupForfeitAmount', 'Deposit forfeited')}
            </Text>
            <Text
              variant="titleMedium"
              style={[
                typography.h6,
                { color: colors.text.primary, fontWeight: '700' },
              ]}
            >
              {depositAmount} {currency}
            </Text>
            <Text
              variant="bodySmall"
              style={[
                typography.body2,
                {
                  color: colors.text.primary,
                  marginTop: spacing.sm,
                  lineHeight: 20,
                },
              ]}
            >
              {mode === 'ready_for_pickup'
                ? t(
                    'deposit.forfeit.youKeepDepositIfPickup',
                    'You will keep the deposit only if we cancel or the store cancels.'
                  )
                : t(
                    'deposit.forfeit.youKeepDepositIfDelivery',
                    'You will keep the deposit only if we cancel, the store cancels, or delivery fails.'
                  )}
            </Text>
          </View>

          <View
            style={[
              styles.actions,
              {
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            <Button
              mode="outlined"
              onPress={onKeep}
              disabled={loading}
              style={styles.actionButton}
              contentStyle={styles.actionButtonContent}
              labelStyle={{ color: colors.text.primary }}
            >
              {primaryCta}
            </Button>
            <Button
              mode="contained"
              onPress={onCancelAndForfeit}
              loading={loading}
              disabled={loading}
              style={[styles.actionButton, { backgroundColor: colors.error.main }]}
              contentStyle={styles.actionButtonContent}
              buttonColor={colors.error.main}
              textColor="#FFFFFF"
            >
              {dangerCta}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 500,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
  },
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  forfeitBox: {},
  actions: {
    flexDirection: 'column',
    width: '100%',
  },
  actionButton: {
    width: '100%',
    alignSelf: 'stretch',
  },
  actionButtonContent: {
    height: 48,
    justifyContent: 'center',
  },
});
