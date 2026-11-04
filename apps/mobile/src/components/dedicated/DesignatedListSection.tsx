import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import { navigateToOrderFromPush } from '../../navigation/rootNavigationRef';
import type { DesignatedMineResponse } from '../../types/designated';
import { formatDateTime, formatWindow } from '../../utils/designatedFirst';

/** Designated agent first: my early offers and upcoming designated orders (tap opens the order). */
export function DesignatedListSection() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [list, setList] = useState<DesignatedMineResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      dedicatedAgentsService
        .getDesignatedMine()
        .then((res) => !cancelled && setList(res))
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const offers = list?.offers ?? [];
  const upcoming = list?.upcoming ?? [];
  if (!offers.length && !upcoming.length) return null;
  const rowStyle = [styles.row, { borderColor: colors.divider, borderRadius: borderRadius.sm, padding: spacing.sm }];

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }} testID="designated-list">
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('designatedFirst.list.title', 'My designated deliveries')}
      </Text>
      {offers.map((o) => (
        <Pressable key={`o-${o.orderId}`} style={rowStyle} onPress={() => navigateToOrderFromPush(o.orderId, 'agent')}>
          <Text variant="labelMedium" style={{ color: colors.primary.main }}>
            {t('designatedFirst.list.offerBadge', 'Offer')}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
            {[o.details?.businessName, o.details?.date, formatWindow(o.details?.windowStart, o.details?.windowEnd)].filter(Boolean).join(' · ')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('designatedFirst.offer.acceptBeforeShort', {
              defaultValue: 'Accept before {{time}}',
              time: formatDateTime(o.expiresAt, i18n.language),
            })}
          </Text>
        </Pressable>
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

const styles = StyleSheet.create({
  row: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
