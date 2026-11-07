import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import { agentApi } from '../../services/agentApi';
import { navigateToOrderFromPush } from '../../navigation/rootNavigationRef';
import type { DesignatedMineResponse, DesignatedOffer } from '../../types/designated';
import { formatDateTime, formatWindow } from '../../utils/designatedFirst';

/** Designated agent first: coverage/early offers (Take) and assigned upcoming (tap opens). */
export function DesignatedListSection({ showWhenEmpty = false }: { showWhenEmpty?: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [list, setList] = useState<DesignatedMineResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await dedicatedAgentsService.getDesignatedMine();
      setList(res);
      setError(null);
    } catch {
      // Keep last good list.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const take = useCallback(
    async (orderId: string) => {
      setBusyId(orderId);
      setError(null);
      try {
        await agentApi.orders.acceptOffer(orderId);
        await reload();
      } catch (err: unknown) {
        const message = err instanceof Error && err.message.trim() ? err.message : null;
        setError(message ?? t('designatedFirst.error', 'Could not update. Try again.'));
        await reload();
      } finally {
        setBusyId(null);
      }
    },
    [reload, t]
  );

  const offers = list?.offers ?? [];
  const upcoming = list?.upcoming ?? [];
  const isEmpty = !offers.length && !upcoming.length;
  if (isEmpty && !showWhenEmpty) return null;
  const rowStyle = [styles.row, { borderColor: colors.divider, borderRadius: borderRadius.sm, padding: spacing.sm }];

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }} testID="designated-list">
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('designatedFirst.list.title', 'Dedicated orders')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'designatedFirst.list.subtitle',
          'Orders from your dedicated stores that you can take'
        )}
      </Text>
      {error ? (
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {error}
        </Text>
      ) : null}
      {isEmpty ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t('designatedFirst.list.empty', 'No dedicated orders to take right now.')}
        </Text>
      ) : null}
      {offers.map((o) => (
        <OfferRow
          key={`o-${o.orderId}`}
          offer={o}
          rowStyle={rowStyle}
          busy={busyId === o.orderId}
          onTake={() => void take(o.orderId)}
          language={i18n.language}
          colors={colors}
        />
      ))}
      {upcoming.map((u) => (
        <Pressable key={`u-${u.orderId}`} style={rowStyle} onPress={() => navigateToOrderFromPush(u.orderId, 'agent')}>
          <Text variant="labelMedium" style={{ color: colors.success?.main ?? colors.primary.main }}>
            {t('designatedFirst.list.assignedBadge', 'Assigned')}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
            {[`#${u.orderNumber}`, u.storeName, u.date, formatWindow(u.windowStart, u.windowEnd)].filter(Boolean).join(' · ')}
          </Text>
          {!u.confirmedAt ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('designatedFirst.upcoming.stillOnIt', 'Still on it')}?
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function OfferRow({
  offer,
  rowStyle,
  busy,
  onTake,
  language,
  colors,
}: {
  offer: DesignatedOffer;
  rowStyle: object[];
  busy: boolean;
  onTake: () => void;
  language: string;
  colors: { primary: { main: string }; text: { primary: string; secondary: string } };
}) {
  const { t } = useTranslation();
  const claimable = offer.phase === 'early' || offer.phase === 'gate';
  return (
    <View style={[rowStyle, styles.offerCard]}>
      <Pressable style={styles.offerBody} onPress={() => navigateToOrderFromPush(offer.orderId, 'agent')}>
        <Text variant="labelMedium" style={{ color: colors.primary.main }}>
          {t('designatedFirst.list.offerBadge', 'Available')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
          {[offer.details?.businessName, offer.details?.date, formatWindow(offer.details?.windowStart, offer.details?.windowEnd)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('designatedFirst.offer.acceptBeforeShort', {
            defaultValue: 'Accept before {{time}}',
            time: formatDateTime(offer.expiresAt, language),
          })}
        </Text>
      </Pressable>
      {claimable ? (
        <Button mode="contained" onPress={onTake} loading={busy} disabled={busy} compact>
          {t('designatedFirst.home.take', "I'll take this")}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  offerCard: { flexDirection: 'column', alignItems: 'stretch' },
  offerBody: { gap: 2 },
});
