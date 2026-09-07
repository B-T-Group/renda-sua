import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { rentalsApi } from '../../services/rentalsApi';
import { useTheme } from '../../contexts/ThemeContext';

const RESEND_COOLDOWN_MS = 60_000;

type Props = {
  bookingId: string;
  onSent?: () => void;
  onError?: (message: string) => void;
  compact?: boolean;
};

export function SendRentalStartPinButton({
  bookingId,
  onSent,
  onError,
  compact,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);

  useEffect(() => {
    if (!sentAt || cooldownMs <= 0) return;
    const timer = setInterval(() => {
      const remaining = RESEND_COOLDOWN_MS - (Date.now() - sentAt);
      setCooldownMs(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt, cooldownMs]);

  const handleSend = useCallback(async () => {
    setLoading(true);
    try {
      await rentalsApi.shareStartPin(bookingId);
      setSentAt(Date.now());
      setCooldownMs(RESEND_COOLDOWN_MS);
      onSent?.();
    } catch (e: unknown) {
      onError?.(
        e instanceof Error
          ? e.message
          : t(
              'rentals.messaging.startPin.unavailable',
              'Start PIN is not available. Try again in a moment.'
            )
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, onError, onSent, t]);

  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

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
        disabled={loading || (sentAt != null && cooldownMs > 0)}
        compact={compact}
        accessibilityLabel={t(
          'rentals.messaging.startPin.sendA11y',
          'Send start PIN to the business'
        )}
      >
        {t('rentals.messaging.startPin.sendPin', 'Send start PIN')}
      </Button>
      {sentAt && !loading ? (
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
          {t(
            'rentals.messaging.startPin.sentConfirmation',
            'PIN shared in booking chat. The business will be notified.'
          )}
        </Text>
      ) : null}
      {sentAt && cooldownMs > 0 ? (
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t(
            'rentals.messaging.startPin.resendCooldown',
            'You can send again in {{seconds}}s',
            { seconds: cooldownSeconds }
          )}
        </Text>
      ) : sentAt && cooldownMs <= 0 ? (
        <Button mode="text" compact onPress={() => void handleSend()} disabled={loading}>
          {t('rentals.messaging.startPin.resend', 'Send again')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
});
