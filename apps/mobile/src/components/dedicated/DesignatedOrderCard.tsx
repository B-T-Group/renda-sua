import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import { agentApi } from '../../services/agentApi';
import type { DesignatedMineResponse } from '../../types/designated';
import type { DedicatedDeclineReason } from '../../utils/dedicatedRelease';
import {
  classifyDesignatedError,
  findDesignated,
  formatDateTime,
  formatKmShort,
  formatWindow,
  isFreeRelease,
} from '../../utils/designatedFirst';
import { DeclineReasonChips } from './DeclineReasonChips';

interface Props {
  orderId: string | null | undefined;
  /** Tells the parent whether this order is designated-first for me (hides the legacy cards). */
  onDesignated?: (isDesignated: boolean) => void;
  /** The order left this agent (released / declined): leave the screen. */
  onGone: () => void;
  /** The order changed (accepted / refused by the server): reload it. */
  onRefresh: () => void;
}

/**
 * Designated agent first: the early offer ("accept before {gate}") with area and distances,
 * then "Still on it" / "Can't make it" (free before the cutoff, a strike after it).
 */
export function DesignatedOrderCard({ orderId, onDesignated, onGone, onRefresh }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [list, setList] = useState<DesignatedMineResponse | null>(null);
  const [mode, setMode] = useState<'idle' | 'declining' | 'releasing'>('idle');
  const [reason, setReason] = useState<DedicatedDeclineReason | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setList(await dedicatedAgentsService.getDesignatedMine());
    } catch {
      setList(null);
    }
  }, [orderId]);

  useEffect(() => {
    setList(null);
    setMode('idle');
    setMessage(null);
    void load();
  }, [load]);

  const entry = findDesignated(list, orderId);
  const isDesignated = !!entry;
  useEffect(() => {
    onDesignated?.(isDesignated);
  }, [isDesignated, onDesignated]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, after: 'gone' | 'refresh' | 'reload', ok?: string) => {
      setLoading(true);
      setMessage(null);
      try {
        await fn();
        setMode('idle');
        if (ok) setMessage(ok);
        if (after === 'gone') onGone();
        else if (after === 'refresh') onRefresh();
        await load();
      } catch (err) {
        const f = classifyDesignatedError(err);
        setMessage(f.message ?? t('designatedFirst.error', 'Could not update. Try again.'));
        if (f.kind === 'refresh') {
          onRefresh();
          await load();
        }
      } finally {
        setLoading(false);
      }
    },
    [load, onGone, onRefresh, t]
  );

  if (!orderId || !entry) return null;
  const lang = i18n.language;
  const box = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.primary.main, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
  ];
  const secondary = { color: colors.text.secondary };
  const msg = message ? (
    <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
      {message}
    </Text>
  ) : null;

  if (entry.kind === 'offer') {
    const { offer } = entry;
    const d = offer.details;
    const earnings = offer.estimatedEarnings ?? d?.commission ?? null;
    return (
      <View style={box}>
        <Text variant="titleSmall" style={{ color: colors.text.primary }}>
          {t('designatedFirst.offer.title', 'Your designated delivery')}
        </Text>
        <Text variant="bodyMedium" style={secondary}>
          {t('designatedFirst.offer.acceptBefore', {
            defaultValue: 'Accept before {{time}}. After that it goes to other agents.',
            time: formatDateTime(offer.expiresAt, lang),
          })}
        </Text>
        {d ? (
          <>
            <Text variant="bodyMedium" style={secondary}>
              {t('designatedFirst.offer.slot', {
                defaultValue: 'Slot: {{date}} {{window}}',
                date: d.date ?? '',
                window: formatWindow(d.windowStart, d.windowEnd),
              })}
            </Text>
            <Text variant="bodyMedium" style={secondary}>
              {t('designatedFirst.offer.pickup', {
                defaultValue: 'Pickup: {{store}}, {{area}} {{km}}',
                store: d.businessName,
                area: d.pickupArea,
                km: formatKmShort(d.pickupKm),
              })}
            </Text>
            <Text variant="bodyMedium" style={secondary}>
              {t('designatedFirst.offer.dropoff', {
                defaultValue: 'Drop-off area: {{area}} {{km}}',
                area: d.dropoffArea,
                km: formatKmShort(d.dropoffKm),
              })}
            </Text>
          </>
        ) : null}
        {earnings != null ? (
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {t('designatedFirst.offer.earnings', {
              defaultValue: 'Earnings: {{amount}} {{currency}}',
              amount: Math.round(earnings),
              currency: offer.currency ?? d?.currency ?? '',
            })}
          </Text>
        ) : null}
        {mode === 'declining' ? <DeclineReasonChips value={reason} onChange={setReason} disabled={loading} /> : null}
        {msg}
        <View style={styles.actions}>
          {mode === 'declining' ? (
            <>
              <Button mode="text" onPress={() => setMode('idle')} disabled={loading}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                buttonColor={colors.error.main}
                textColor={colors.onDark}
                loading={loading}
                disabled={loading}
                onPress={() => void run(() => agentApi.orders.declineOffer(orderId, reason ?? undefined), 'gone')}
              >
                {t('designatedFirst.offer.declineConfirm', 'Decline')}
              </Button>
            </>
          ) : (
            <>
              <Button mode="outlined" textColor={colors.error.main} onPress={() => setMode('declining')} disabled={loading}>
                {t('designatedFirst.offer.decline', 'Decline')}
              </Button>
              <Button
                mode="contained"
                loading={loading}
                disabled={loading}
                onPress={() =>
                  void run(
                    () => agentApi.orders.acceptOffer(orderId),
                    'refresh',
                    t('designatedFirst.offer.accepted', 'Accepted. It is yours for this slot.')
                  )
                }
              >
                {t('designatedFirst.offer.accept', 'Accept')}
              </Button>
            </>
          )}
        </View>
      </View>
    );
  }

  const up = entry.upcoming;
  const free = isFreeRelease(up);
  return (
    <View style={box}>
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('designatedFirst.upcoming.title', 'Your designated delivery')}
      </Text>
      <Text variant="bodyMedium" style={secondary}>
        {t('designatedFirst.offer.slot', {
          defaultValue: 'Slot: {{date}} {{window}}',
          date: up.date ?? '',
          window: formatWindow(up.windowStart, up.windowEnd),
        })}
      </Text>
      <Text variant="bodyMedium" style={secondary}>
        {up.confirmedAt
          ? t('designatedFirst.upcoming.confirmed', "You confirmed you're still on it.")
          : t('designatedFirst.upcoming.notConfirmed', "Let us know you're still on it.")}
      </Text>
      <Text variant="bodySmall" style={secondary}>
        {free
          ? t('designatedFirst.upcoming.freeUntil', {
              defaultValue: 'You can hand it back without penalty until {{time}}.',
              time: formatDateTime(up.releaseCutoffAt, lang),
            })
          : t('designatedFirst.upcoming.lateWarning', 'Handing it back now counts as a strike (no fee).')}
      </Text>
      {mode === 'releasing' ? (
        <>
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {free
              ? t('designatedFirst.upcoming.releaseConfirmFree', 'Hand this order back? It goes to other agents. No penalty.')
              : t('designatedFirst.upcoming.releaseConfirmLate', 'Hand this order back? This counts as a strike.')}
          </Text>
          <DeclineReasonChips value={reason} onChange={setReason} disabled={loading} />
        </>
      ) : null}
      {msg}
      <View style={styles.actions}>
        {mode === 'releasing' ? (
          <>
            <Button mode="text" onPress={() => setMode('idle')} disabled={loading}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              buttonColor={colors.error.main}
              textColor={colors.onDark}
              loading={loading}
              disabled={loading}
              onPress={() => void run(() => dedicatedAgentsService.releaseDesignated(orderId, reason ?? 'other'), 'gone')}
            >
              {t('designatedFirst.upcoming.releaseButton', 'Hand it back')}
            </Button>
          </>
        ) : (
          <>
            <Button mode="outlined" textColor={colors.error.main} onPress={() => setMode('releasing')} disabled={loading}>
              {t('designatedFirst.upcoming.cantMakeIt', "Can't make it")}
            </Button>
            {!up.confirmedAt ? (
              <Button
                mode="contained"
                loading={loading}
                disabled={loading}
                onPress={() => void run(() => dedicatedAgentsService.confirmDesignated(orderId), 'reload')}
              >
                {t('designatedFirst.upcoming.stillOnIt', 'Still on it')}
              </Button>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});
