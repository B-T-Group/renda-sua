import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import { agentApi } from '../../services/agentApi';
import { navigateToOrderFromPush } from '../../navigation/rootNavigationRef';
import type { DesignatedOffer } from '../../types/designated';
import { formatDateTime, formatWindow } from '../../utils/designatedFirst';
import { earlyDesignatedOffers } from '../../utils/earlyDesignatedOffers';

type Props = {
  /** Called after Take succeeds so open/active order lists can refresh. */
  onAccepted?: () => void;
};

/**
 * Future designated early offers on the agent home: Take accepts the offer;
 * Ignore only hides the card (no strike; a reminder push can still be accepted).
 */
export function DesignatedHomeOffersSection({ onAccepted }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [offers, setOffers] = useState<DesignatedOffer[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await dedicatedAgentsService.getDesignatedMine();
      setOffers(earlyDesignatedOffers(res?.offers));
      setError(null);
    } catch {
      // Leave the last good list; home still has Available Deliveries.
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
        setOffers((prev) => prev.filter((o) => o.orderId !== orderId));
        onAccepted?.();
      } catch {
        setError(t('designatedFirst.error', 'Could not update. Try again.'));
        await reload();
      } finally {
        setBusyId(null);
      }
    },
    [onAccepted, reload, t]
  );

  const ignore = useCallback(
    async (orderId: string) => {
      setBusyId(orderId);
      setError(null);
      try {
        await dedicatedAgentsService.dismissDesignated(orderId);
        setOffers((prev) => prev.filter((o) => o.orderId !== orderId));
      } catch {
        setError(t('designatedFirst.error', 'Could not update. Try again.'));
        await reload();
      } finally {
        setBusyId(null);
      }
    },
    [reload, t]
  );

  if (offers.length === 0) return null;

  return (
    <View
      style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.xs }}
      testID="designated-home-offers"
    >
      <View style={styles.header}>
        <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary.main} />
        <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700', flex: 1 }}>
          {t('designatedFirst.home.title', 'Your upcoming dedicated deliveries')}
        </Text>
      </View>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'designatedFirst.home.subtitle',
          'Upcoming orders for your dedicated stores and slots. Take one now to plan ahead — even if you missed the notification.'
        )}
      </Text>
      {error ? (
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {error}
        </Text>
      ) : null}
      {offers.map((offer) => {
        const d = offer.details;
        const title = [d?.businessName, d?.date, formatWindow(d?.windowStart, d?.windowEnd)]
          .filter(Boolean)
          .join(' · ');
        const gate = d?.gateAt ?? offer.expiresAt;
        const busy = busyId === offer.orderId;
        return (
          <View
            key={offer.orderId}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.primary.main,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                gap: spacing.sm,
              },
            ]}
          >
            <Pressable onPress={() => navigateToOrderFromPush(offer.orderId, 'agent')}>
              <Text variant="labelMedium" style={{ color: colors.primary.main }}>
                {t('designatedFirst.list.offerBadge', 'Offer')}
              </Text>
              <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700', marginTop: 2 }}>
                {title || t('designatedFirst.offer.title', 'Your designated delivery')}
              </Text>
              {gate ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                  {t('designatedFirst.home.opensAt', {
                    defaultValue: 'Dispatch opens {{time}}',
                    time: formatDateTime(gate, i18n.language),
                  })}
                </Text>
              ) : null}
            </Pressable>
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={() => void ignore(offer.orderId)}
                disabled={busy}
                compact
              >
                {t('designatedFirst.home.ignore', 'Ignore')}
              </Button>
              <Button
                mode="contained"
                onPress={() => void take(offer.orderId)}
                loading={busy}
                disabled={busy}
                compact
              >
                {t('designatedFirst.home.take', "I'll take this")}
              </Button>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});
