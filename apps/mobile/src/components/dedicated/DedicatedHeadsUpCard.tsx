import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import dedicatedAgentsService, { type DedicatedHeadsUpResponse } from '../../services/dedicatedAgentsService';
import { headsUpCardState, headsUpDispatchTime } from '../../utils/dedicatedHeadsUp';

interface Props {
  orderId: string | null | undefined;
  /** Only fetch while the order is ready and unassigned. */
  enabled: boolean;
}

/**
 * Early dedicated heads-up (soft, not an offer): "you may get this later" with a
 * "Can't take it" that skips this agent for the order's dedicated dispatch.
 */
export function DedicatedHeadsUpCard({ orderId, enabled }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [headsUp, setHeadsUp] = useState<DedicatedHeadsUpResponse['headsUp']>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHeadsUp(null);
    setConfirming(false);
    setError(null);
    if (!orderId || !enabled) return;
    let cancelled = false;
    dedicatedAgentsService
      .getHeadsUp(orderId)
      .then((res) => {
        if (!cancelled) setHeadsUp(res?.headsUp ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orderId, enabled]);

  const markUnavailable = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      await dedicatedAgentsService.markHeadsUpUnavailable(orderId);
      setHeadsUp((h) => (h ? { ...h, status: 'unavailable' } : h));
      setConfirming(false);
    } catch {
      setError(t('dedicatedAgents.agent.headsUp.error', 'Could not update. Try again.'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  const state = headsUpCardState(enabled ? headsUp : null);
  if (state === 'hidden') return null;
  const time = headsUpDispatchTime(headsUp?.dispatchReadyAt);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('dedicatedAgents.agent.headsUp.title', 'Heads-up: you may get this delivery later')}
      </Text>
      {state === 'marked' ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t('dedicatedAgents.agent.headsUp.marked', "Got it: you won't be offered this order.")}
        </Text>
      ) : (
        <>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {confirming
              ? t('dedicatedAgents.agent.headsUp.confirm', 'Skip you for this order? It will go to other agents. No penalty.')
              : t('dedicatedAgents.agent.headsUp.body', {
                  defaultValue:
                    'This scheduled order is in your dedicated slot. It is not an offer yet: it may come to you when dispatch opens{{time}}.',
                  time: time ? t('dedicatedAgents.agent.headsUp.opensAt', { defaultValue: ' at {{time}}', time }) : '',
                })}
          </Text>
          {error ? (
            <Text variant="bodySmall" style={{ color: colors.error.main }}>
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {confirming ? (
              <>
                <Button mode="text" onPress={() => setConfirming(false)} disabled={loading}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  buttonColor={colors.error.main}
                  textColor={colors.onDark}
                  onPress={() => void markUnavailable()}
                  loading={loading}
                  disabled={loading}
                >
                  {t('dedicatedAgents.agent.headsUp.confirmButton', 'Yes, skip me')}
                </Button>
              </>
            ) : (
              <Button mode="outlined" textColor={colors.error.main} onPress={() => setConfirming(true)}>
                {t('dedicatedAgents.agent.headsUp.cantTake', "Can't take it")}
              </Button>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
