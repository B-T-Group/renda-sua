import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamily } from '../../theme/fonts';
import type { ClientRentalRequestRow as ClientRentalRequest } from '../../types/rentals';
import {
  isProposedContractOpen,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
  proposedContractDeadlineIso,
  resolveRentalPhase,
  rentalPhaseColors,
} from '../../utils/rentals';
import {
  formatListingDeadline,
  formatRequestAmount,
  formatRentalPeriod,
} from '../../utils/rentals/rentalRequestFormat';

export interface ClientRentalRequestRowProps {
  row: ClientRentalRequest;
  bookingLoading?: boolean;
  cancelling?: boolean;
  modifyState?: 'hidden' | 'open' | 'closed';
  onModify?: (id: string) => void;
  onContact?: (bookingId: string) => void;
  onBookRequest: (id: string) => void;
  onCancel: (id: string) => void;
  onViewListing: (listingId: string) => void;
  onViewBooking: (bookingId: string) => void;
}

export function ClientRentalRequestRow({
  row,
  bookingLoading,
  cancelling,
  modifyState = 'hidden',
  onModify,
  onContact,
  onBookRequest,
  onCancel,
  onViewListing,
  onViewBooking,
}: ClientRentalRequestRowProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const listing = row.rental_location_listing;
  const itemName = listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const place = placeLine(row);
  const subtitle = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const phase = resolveRentalPhase(
    { requestStatus: row.status, bookingStatus: row.rental_booking?.status ?? null },
    'client'
  );
  const statusColors = rentalPhaseColors(phase.phase, colors);
  const statusLabel = cardStatusLabel(row.status, phase.labelKey, t);
  const updated = (row.change_summary?.fields?.length ?? 0) > 0;
  const deadlineIso = proposedContractDeadlineIso(row);
  const canBookNow = row.status === 'available' && isProposedContractOpen(row);
  const bookingId = row.rental_booking?.id;
  const windows = parseRentalSelectionWindows(row.rental_selection_windows);
  const period = formatRentalPeriod(windows, i18n.language, (count) =>
    t('rentals.requestForm.dayCount', '{{count}} day', { count })
  );
  const total = quotedAmount(row, quote?.total);
  const currency = listing?.rental_item?.currency || quote?.currency || 'XAF';
  const amount = Number.isFinite(total)
    ? `${row.units_requested ?? 1} × · ${formatRequestAmount(total as number, currency, i18n.language)}`
    : null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={styles.statusRow}>
        <StatusPill
          label={statusLabel}
          backgroundColor={statusColors.backgroundColor}
          textColor={statusColors.textColor}
          borderColor={statusColors.borderColor}
          compact
        />
        {updated ? (
          <StatusPill
            label={t('rentals.modify.updated', 'Updated')}
            backgroundColor={colors.primary.main + '18'}
            textColor={colors.primary.main}
            borderColor={colors.primary.main + '44'}
            compact
          />
        ) : null}
        <View style={styles.flex} />
        {listing?.id ? (
          <Pressable accessibilityLabel={t('rentals.clientRequests.viewListing', 'View listing')} onPress={() => onViewListing(listing.id)}>
            <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.header, { marginTop: spacing.sm }]}>
        <Pressable
          onPress={() => listing?.id && onViewListing(listing.id)}
          style={[styles.thumb, { backgroundColor: colors.primary.main + '18' }]}
        >
          <MaterialCommunityIcons name="warehouse" size={26} color={colors.primary.main} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[typography.subtitle1, { color: colors.text.primary, fontFamily: fontFamily.medium }]}>
            {itemName}
          </Text>
          {subtitle ? (
            <Text style={[typography.caption, { color: colors.text.secondary }]}>{subtitle}</Text>
          ) : null}
          {place ? (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.text.secondary} />
              <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 4, flex: 1 }]}>{place}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
        <MaterialCommunityIcons name="calendar-outline" size={16} color={colors.text.secondary} />
        <Text
          style={[
            typography.body2,
            {
              color: colors.text.primary,
              marginLeft: 6,
              fontFamily: fontFamily.bold,
              fontWeight: '700',
            },
          ]}
        >
          {period}
        </Text>
      </View>
      {amount ? (
        <Text style={[typography.body2, { color: colors.text.primary, marginTop: 2, marginLeft: 22 }]}>{amount}</Text>
      ) : null}

      {row.status === 'available' && deadlineIso ? (
        <Text
          style={[
            typography.caption,
            {
              color: canBookNow ? colors.text.secondary : colors.error.main,
              marginTop: spacing.xs,
              fontFamily: fontFamily.medium,
            },
          ]}
        >
          {canBookNow
            ? t('rentals.clientRequests.contractCompleteBy', 'Complete booking by {{date}}', {
                date: formatListingDeadline(deadlineIso, i18n.language),
              })
            : t('rentals.clientRequests.contractExpiredHint', 'This offer has expired. You can send a new request from the listing.')}
        </Text>
      ) : null}

      <View style={[styles.actions, { marginTop: spacing.sm }]}>
        {modifyState !== 'hidden' ? (
          <Button
            mode="outlined"
            icon="pencil-outline"
            disabled={modifyState === 'closed'}
            onPress={() => onModify?.(row.id)}
            style={styles.modify}
          >
            {t('rentals.modify.action', 'Modify')}
          </Button>
        ) : null}
        {row.status === 'pending' ? (
          <Pressable onPress={() => onCancel(row.id)} disabled={cancelling} style={styles.cancel}>
            <Text style={{ color: colors.error.main, fontWeight: '700' }}>
              {t('rentals.clientRequests.cancelRequest', 'Cancel request')}
            </Text>
          </Pressable>
        ) : null}
        {row.status === 'available' ? (
          <Pressable onPress={() => onCancel(row.id)} disabled={cancelling} style={styles.cancel}>
            <Text style={{ color: colors.error.main, fontWeight: '700' }}>{t('rentals.modify.cancel', 'Cancel')}</Text>
          </Pressable>
        ) : null}
        {row.status === 'available' && bookingId ? (
          <Button mode="outlined" icon="message-outline" onPress={() => onContact?.(bookingId)}>
            {t('rentals.modify.contact', 'Contact')}
          </Button>
        ) : null}
        {canBookNow ? (
          <Button mode="contained" loading={bookingLoading} disabled={bookingLoading} onPress={() => onBookRequest(row.id)}>
            {t('rentals.bookNow', 'Book now')}
          </Button>
        ) : null}
        {row.status === 'booked' && bookingId ? (
          <Button mode="contained" onPress={() => onViewBooking(bookingId)}>
            {t('rentals.actions.openBooking', 'Open booking')}
          </Button>
        ) : null}
      </View>
      {modifyState === 'closed' ? (
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
          {t('rentals.modify.windowClosed', 'Changes close 2 hours before the rental starts.')}
        </Text>
      ) : null}
    </View>
  );
}

function placeLine(row: ClientRentalRequest): string {
  const city = row.rental_location_listing?.business_location?.address?.city;
  const business = row.rental_location_listing?.rental_item?.business?.name;
  return [business, city].filter(Boolean).join(' · ');
}

function quotedAmount(row: ClientRentalRequest, snapshotTotal?: number): number | null {
  if (row.quoted_total != null && row.quoted_total !== '') {
    const quoted = Number(row.quoted_total);
    if (Number.isFinite(quoted)) return quoted;
  }
  return snapshotTotal ?? null;
}

function cardStatusLabel(
  status: string,
  phaseKey: string,
  t: (key: string, fallback: string) => string
): string {
  if (status === 'pending') return t('rentals.modify.requested', 'Requested');
  if (status === 'available') return t('rentals.modify.accepted', 'Accepted');
  return t(phaseKey, status);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  modify: { flexGrow: 1 },
  cancel: { paddingHorizontal: 8, paddingVertical: 10 },
});
