import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { businessApi } from '../../services/businessApi';

type PauseDuration = '15m' | '1h' | 'until_tomorrow' | 'indefinite';

export function BusinessAvailabilityCard() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(true);
  const [reliability, setReliability] = useState<{
    acceptanceRatePct: number;
    averageAcceptanceSeconds: number | null;
    autoDeclineRatePct: number;
    merchantCancelRatePct: number;
    reliability_score: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await businessApi.orders.getReliability();
      setAccepting(data.accepting_orders !== false);
      setReliability({
        acceptanceRatePct: data.acceptanceRatePct,
        averageAcceptanceSeconds: data.averageAcceptanceSeconds,
        autoDeclineRatePct: data.autoDeclineRatePct,
        merchantCancelRatePct: data.merchantCancelRatePct,
        reliability_score: data.reliability_score,
      });
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const pause = async (duration: PauseDuration) => {
    setLoading(true);
    try {
      await businessApi.orders.pauseAvailability(duration);
      setAccepting(false);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const resume = async () => {
    setLoading(true);
    try {
      await businessApi.orders.resumeAvailability();
      setAccepting(true);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {t('businessAvailability.title', 'Store availability')}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {accepting
          ? t('businessAvailability.open', 'Accepting orders')
          : t('businessAvailability.paused', 'Not accepting orders')}
      </Text>
      {reliability ? (
        <View style={{ gap: 4 }}>
          <Text variant="labelLarge" style={{ color: colors.text.primary }}>
            {t('businessAvailability.reliabilityTitle', 'Reliability')} ·{' '}
            {reliability.reliability_score}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('businessAvailability.accepted', 'Orders accepted')}:{' '}
            {reliability.acceptanceRatePct}%
            {reliability.averageAcceptanceSeconds != null
              ? ` · ${t('businessAvailability.avgTime', 'Avg acceptance time')}: ${reliability.averageAcceptanceSeconds}s`
              : ''}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('businessAvailability.autoDeclines', 'Auto-declines')}:{' '}
            {reliability.autoDeclineRatePct}% ·{' '}
            {t('businessAvailability.merchantCancels', 'Merchant cancellations')}:{' '}
            {reliability.merchantCancelRatePct}%
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        {accepting ? (
          <>
            <Button compact mode="outlined" disabled={loading} onPress={() => void pause('15m')}>
              {t('businessAvailability.pause15', 'Pause 15 min')}
            </Button>
            <Button compact mode="outlined" disabled={loading} onPress={() => void pause('1h')}>
              {t('businessAvailability.pause1h', 'Pause 1 hour')}
            </Button>
            <Button
              compact
              mode="outlined"
              disabled={loading}
              onPress={() => void pause('until_tomorrow')}
            >
              {t('businessAvailability.pauseTomorrow', 'Pause until tomorrow')}
            </Button>
            <Button
              compact
              mode="text"
              disabled={loading}
              onPress={() => void pause('indefinite')}
            >
              {t('businessAvailability.pauseIndefinite', 'Pause indefinitely')}
            </Button>
          </>
        ) : (
          <Button mode="contained" disabled={loading} onPress={() => void resume()}>
            {t('businessAvailability.resume', 'Resume orders')}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
