import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRentalRequestRow } from '../../types/rentals';
import {
  dashboardPeriodLabel,
  formatYouReceive,
  respondWithinAmber,
  respondWithinHours,
  startInDays,
} from '../../utils/rentals/dashboardRentalRequests';

export function DashboardRentalRequestCard({
  request,
  width,
  onAccept,
  onDecline,
}: {
  request: BusinessRentalRequestRow;
  width: number;
  onAccept: (request: BusinessRentalRequestRow) => void;
  onDecline: (request: BusinessRentalRequestRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const windows = request.rental_selection_windows ?? [];
  const period = dashboardPeriodLabel(
    windows,
    i18n.language,
    t('business.dashboard.rentalRequests.allDay', 'All day'),
    (count) => t('business.dashboard.rentalRequests.dayCount', '{{count}} days', { count })
  );
  const amount = request.quoted_total != null ? Number(request.quoted_total) : Number.NaN;
  const currency = request.rental_location_listing.rental_item.currency || 'CAD';
  const hours = request.respond_by ? respondWithinHours(request.respond_by) : 0;
  const amber = request.respond_by ? respondWithinAmber(request.respond_by) : false;
  const daysOut = startInDays(windows[0]?.calendar_date, request.listing_timezone || 'America/Toronto');
  const renter = [request.client?.user?.first_name, request.client?.user?.last_name].filter(Boolean).join(' ');
  const photo = request.rental_location_listing.rental_item.rental_item_images?.[0];
  const uri = photo?.display_url || photo?.thumbnail || photo?.image_url;
  const updated = (request.change_summary?.fields?.length ?? 0) > 0;
  const daily = windows.length > 1 ? Number(request.rental_location_listing.base_price_per_day) : 0;

  return (
    <View style={[styles.card, { width, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.sm }]}>
      <View style={styles.row}>
        {uri ? <Image source={{ uri }} style={styles.photo} /> : <View style={[styles.photo, { backgroundColor: colors.divider }]} />}
        <View style={styles.body}>
          <Text variant="labelSmall">{t('business.dashboard.rentalRequests.requested', 'Requested')}</Text>
          {daysOut === 0 ? <Text variant="labelSmall" style={{ color: colors.warning.dark }}>{t('business.dashboard.rentalRequests.startsToday', 'Starts today')}</Text> : null}
          {daysOut != null && daysOut > 0 ? <Text variant="labelSmall">{t('business.dashboard.rentalRequests.startsIn', 'Starts in {{count}} days', { count: daysOut })}</Text> : null}
          {updated ? <Text variant="labelSmall">{t('business.dashboard.rentalRequests.updated', 'Updated')}</Text> : null}
          <Text variant="titleSmall">{request.rental_location_listing.rental_item.name}</Text>
          <Text variant="bodySmall">{renter}</Text>
          <Text variant="bodySmall">{period}</Text>
          {daily > 0 ? (
            <Text variant="labelSmall">
              {t('business.dashboard.rentalRequests.dailyRate', '{{count}} days × {{rate}} / day', {
                count: windows.length,
                rate: formatYouReceive(daily, currency, i18n.language),
              })}
            </Text>
          ) : null}
          {Number.isFinite(amount) ? (
            <Text variant="titleSmall">
              {t('business.dashboard.rentalRequests.youReceive', 'You receive')} {formatYouReceive(amount, currency, i18n.language)}
            </Text>
          ) : null}
          {hours > 0 ? (
            <Text variant="bodySmall" style={{ color: amber ? colors.warning.dark : colors.text.secondary, fontWeight: amber ? '700' : '500' }}>
              {t('business.dashboard.rentalRequests.respondWithin', 'Respond within {{hours}}h', { hours })}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel={t('business.dashboard.rentalRequests.accept', 'Accept')} onPress={() => onAccept(request)} style={[styles.iconBtn, { backgroundColor: colors.success.main }]}>
          <MaterialCommunityIcons name="check" color="#fff" size={22} />
        </Pressable>
        <Pressable accessibilityLabel={t('business.dashboard.rentalRequests.decline', 'Decline')} onPress={() => onDecline(request)} style={[styles.iconBtn, styles.decline, { borderColor: colors.divider }]}>
          <MaterialCommunityIcons name="close" color={colors.error.main} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginRight: 12 },
  row: { flexDirection: 'row', gap: 12 },
  photo: { width: 64, height: 64, borderRadius: 12 },
  body: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  decline: { borderWidth: 1, backgroundColor: '#fff' },
});
