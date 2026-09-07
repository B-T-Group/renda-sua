import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { agentApi } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';

const RESEND_COOLDOWN_MS = 60_000;

type Props = {
  orderId: string;
  /** Who receives the PIN in order chat. */
  pinAudience?: 'agent' | 'business';
  onSent?: () => void;
  onError?: (message: string) => void;
  compact?: boolean;
};

export function SendDeliveryPinButton({
  orderId,
  pinAudience = 'agent',
  onSent,
  onError,
  compact,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);
  const inFlightRef = useRef(false);
  const isPickup = pinAudience === 'business';

  useEffect(() => {
    if (!sentAt || cooldownMs <= 0) return;
    const timer = setInterval(() => {
      const remaining = RESEND_COOLDOWN_MS - (Date.now() - sentAt);
      setCooldownMs(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt, cooldownMs]);

  const handleSend = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      await agentApi.orders.sendDeliveryPin(orderId);
      const now = Date.now();
      setSentAt(now);
      setCooldownMs(RESEND_COOLDOWN_MS);
      onSent?.();
    } catch (e: unknown) {
      onError?.(
        e instanceof Error
          ? e.message
          : t(
              'orders.deliveryPin.unavailable',
              'Delivery PIN is not available. Try again in a moment.'
            )
      );
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [orderId, onError, onSent, t]);

  const cooldownSeconds = Math.ceil(cooldownMs / 1000);
  const busy = loading || inFlightRef.current;

  return (
    <View style={styles.wrap}>
      <Button
        mode="contained"
        icon={({ size, color }) =>
          loading ? (
            <ActivityIndicator size={size} color={color} />
          ) : (
            <MaterialCommunityIcons name="send" size={size} color={color} />
          )
        }
        onPress={() => void handleSend()}
        disabled={busy || cooldownMs > 0}
        compact={compact}
        accessibilityLabel={
          isPickup
            ? t(
                'orders.messaging.deliveryPin.sendPickupA11y',
                'Send pickup PIN to the store'
              )
            : t(
                'orders.messaging.deliveryPin.sendA11y',
                'Send delivery PIN to assigned agent'
              )
        }
        accessibilityState={{ busy: loading }}
      >
        {isPickup
          ? t('orders.actions.sendPin', 'Send PIN')
          : t('orders.messaging.deliveryPin.sendPin', 'Send delivery PIN')}
      </Button>
      {sentAt && !loading ? (
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
          {isPickup
            ? t(
                'orders.messaging.deliveryPin.sentConfirmationPickup',
                'PIN shared in order chat. The store will be notified.'
              )
            : t(
                'orders.messaging.deliveryPin.sentConfirmation',
                'PIN shared in order chat. Your agent will be notified.'
              )}
        </Text>
      ) : null}
      {sentAt && cooldownMs > 0 ? (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t(
            'orders.messaging.deliveryPin.resendCooldown',
            'You can send again in {{seconds}}s',
            { seconds: cooldownSeconds }
          )}
        </Text>
      ) : sentAt && cooldownMs <= 0 ? (
        <Button mode="text" compact onPress={() => void handleSend()} disabled={busy}>
          {t('orders.messaging.deliveryPin.resend', 'Send again')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
});
