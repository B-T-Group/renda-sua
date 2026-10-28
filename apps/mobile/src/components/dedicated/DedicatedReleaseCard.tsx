import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useCountdown } from '../../hooks/useCountdown';
import { agentApi } from '../../services/agentApi';
import {
  canShowDedicatedRelease,
  classifyDedicatedReleaseError,
  formatReleaseCountdown,
  type DedicatedDeclineReason,
  type DedicatedReleaseOrderFields,
} from '../../utils/dedicatedRelease';
import { DeclineReasonChips } from './DeclineReasonChips';

interface Props {
  order: (DedicatedReleaseOrderFields & { id: string }) | null;
  /** The order is gone from this agent: leave the screen and refresh the active list. */
  onReleased: () => void;
  /** The order changed under us (not theirs any more / already picked up): reload it. */
  onRefresh: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * #664: "Can't take this" for an auto-assigned dedicated order, inside the release window
 * (`dedicated_release_until`). The server is the authority, so there is no client grace period:
 * the card disappears when the countdown reaches 0 and every refusal code is handled.
 */
export function DedicatedReleaseCard({ order, onReleased, onRefresh, style }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<DedicatedDeclineReason | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const until = order?.dedicated_release_until ?? null;
  const secondsLeft = useCountdown(until);

  useEffect(() => {
    setHidden(false);
    setConfirming(false);
    setMessage(null);
    setCanRetry(false);
  }, [order?.id, until]);

  const release = useCallback(async () => {
    if (!order) return;
    setLoading(true);
    setMessage(null);
    setCanRetry(false);
    try {
      await agentApi.orders.releaseDedicated(order.id, reason ?? undefined);
      onReleased();
    } catch (err) {
      const failure = classifyDedicatedReleaseError(err);
      const retryable = failure.kind === 'retry' || failure.kind === 'other';
      setConfirming(retryable);
      setCanRetry(retryable);
      if (failure.kind === 'hide') setHidden(true);
      if (failure.kind === 'refresh') {
        setHidden(true);
        onRefresh();
      }
      setMessage(
        failure.message ??
          (failure.kind === 'hide' || failure.kind === 'refresh'
            ? null
            : t('dedicatedAgents.agent.release.error', 'Could not hand this order back.'))
      );
    } finally {
      setLoading(false);
    }
  }, [onRefresh, onReleased, order, reason, t]);

  if (hidden) {
    return message ? (
      <Text variant="bodySmall" style={[{ color: colors.text.secondary, marginBottom: 12 }]}>
        {message}
      </Text>
    ) : null;
  }
  if (!canShowDedicatedRelease(order) || secondsLeft <= 0) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
        {t('dedicatedAgents.agent.release.countdown', 'You can hand this order back for {{time}}', {
          time: formatReleaseCountdown(secondsLeft),
        })}
      </Text>
      {confirming ? (
        <>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t(
              'dedicatedAgents.agent.release.confirm',
              'Hand this order back? It will go to another agent. No penalty.'
            )}
          </Text>
          <DeclineReasonChips value={reason} onChange={setReason} disabled={loading} />
        </>
      ) : null}
      {message ? (
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {message}
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
              onPress={() => void release()}
              loading={loading}
              disabled={loading}
            >
              {canRetry
                ? t('dedicatedAgents.agent.release.retry', 'Try again')
                : t('dedicatedAgents.agent.release.confirmButton', 'Hand back')}
            </Button>
          </>
        ) : (
          <Button
            mode="outlined"
            textColor={colors.error.main}
            onPress={() => setConfirming(true)}
            accessibilityLabel={t('dedicatedAgents.agent.cantTake', "Can't take this")}
          >
            {t('dedicatedAgents.agent.cantTake', "Can't take this")}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
