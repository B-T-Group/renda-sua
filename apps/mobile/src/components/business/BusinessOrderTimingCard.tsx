import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { businessApi } from '../../services/businessApi';

const LEAD_CHOICES = ['30', '60', '120'] as const;

function secondsToMinutes(sec: number): string {
  return String(Math.max(1, Math.round(sec / 60)));
}

function minutesToSeconds(mins: string): number | null {
  const n = Number(mins);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n * 60);
}

export function BusinessOrderTimingCard() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asapMins, setAsapMins] = useState('5');
  const [futureMins, setFutureMins] = useState('15');
  const [leadMins, setLeadMins] = useState('30');
  const [prepMins, setPrepMins] = useState('25');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await businessApi.orders.getOrderTiming();
      setAsapMins(secondsToMinutes(data.effective.acceptance_timeout_seconds));
      setFutureMins(
        secondsToMinutes(data.effective.future_acceptance_timeout_seconds)
      );
      setLeadMins(String(data.effective.order_activation_lead_minutes));
      setPrepMins(String(data.effective.default_estimated_prep_minutes));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const save = async () => {
    const asapSec = minutesToSeconds(asapMins);
    const futureSec = minutesToSeconds(futureMins);
    const prep = Number(prepMins);
    const lead = Number(leadMins);
    if (asapSec == null || futureSec == null || !Number.isFinite(prep)) {
      setMessage(
        t('businessOrderTiming.invalid', 'Enter valid timing values.')
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await businessApi.orders.updateOrderTiming({
        acceptance_timeout_seconds: asapSec,
        future_acceptance_timeout_seconds: futureSec,
        order_activation_lead_minutes: lead,
        default_estimated_prep_minutes: Math.round(prep),
      });
      setMessage(t('businessOrderTiming.saved', 'Timing settings saved.'));
      await refresh();
    } catch (e: unknown) {
      setMessage(
        e instanceof Error
          ? e.message
          : t('businessOrderTiming.saveFailed', 'Could not save timing.')
      );
    } finally {
      setSaving(false);
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
        {t('businessOrderTiming.title', 'Order confirmation timing')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'businessOrderTiming.help',
          'ASAP orders start the confirm timer immediately. Future orders activate before prep begins.'
        )}
      </Text>

      <TextInput
        mode="outlined"
        label={t('businessOrderTiming.asapMinutes', 'ASAP confirm window (minutes)')}
        value={asapMins}
        onChangeText={setAsapMins}
        keyboardType="number-pad"
        disabled={loading || saving}
      />
      <TextInput
        mode="outlined"
        label={t(
          'businessOrderTiming.futureMinutes',
          'Future-order confirm window (minutes)'
        )}
        value={futureMins}
        onChangeText={setFutureMins}
        keyboardType="number-pad"
        disabled={loading || saving}
      />
      <Text variant="labelLarge" style={{ color: colors.text.primary }}>
        {t(
          'businessOrderTiming.activationLead',
          'Activate before prep starts'
        )}
      </Text>
      <SegmentedButtons
        value={leadMins}
        onValueChange={setLeadMins}
        buttons={LEAD_CHOICES.map((v) => ({
          value: v,
          label: t('businessOrderTiming.leadOption', '{{mins}} min', {
            mins: v,
          }),
          disabled: loading || saving,
        }))}
      />
      <TextInput
        mode="outlined"
        label={t('businessOrderTiming.prepMinutes', 'Default prep time (minutes)')}
        value={prepMins}
        onChangeText={setPrepMins}
        keyboardType="number-pad"
        disabled={loading || saving}
      />

      {message ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {message}
        </Text>
      ) : null}

      <Button mode="contained" loading={saving} disabled={loading || saving} onPress={() => void save()}>
        {t('common.save', 'Save')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
