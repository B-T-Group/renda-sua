import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientRentalRequestRow } from '../../types/rentals';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  isProposedContractOpen,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
  proposedContractDeadlineIso,
  resolveRentalPhase,
  rentalPhaseColors,
} from '../../utils/rentals';

export interface ClientRentalRequestRowProps {
  row: ClientRentalRequestRow;
  bookingLoading?: boolean;
  cancelling?: boolean;
  onBookRequest: (id: string) => void;
  onCancel: (id: string) => void;
  onViewListing: (listingId: string) => void;
  onViewBooking: (bookingId: string) => void;
}

export function ClientRentalRequestRow({
  row,
  bookingLoading,
  cancelling,
  onBookRequest,
  onCancel,
  onViewListing,
  onViewBooking,
}: ClientRentalRequestRowProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();

  const listing = row.rental_location_listing;
  const itemName =
    listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const phase = resolveRentalPhase(
    {
      requestStatus: row.status,
      bookingStatus: row.rental_booking?.status ?? null,
    },
    'client'
  );
  const statusColors = rentalPhaseColors(phase.phase, colors);
  const statusLabel = t(phase.labelKey, row.status);
  const deadlineIso = proposedContractDeadlineIso(row);
  const canBookNow = row.status === 'available' && isProposedContractOpen(row);
  const reasonCode = row.unavailable_reason_code?.trim();
  const bookingId = row.rental_booking?.id;
  const selectionWindows = parseRentalSelectionWindows(row.rental_selection_windows);

  return (
    <>
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
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
            <Text style={[typography.subtitle1, { color: colors.text.primary }]} numberOfLines={2}>
              {itemName}
            </Text>
            {locName ? (
              <View style={[styles.metaRow, { marginTop: 2 }]}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.text.secondary} />
                <Text
                  style={[typography.caption, { color: colors.text.secondary, marginLeft: 4, flex: 1 }]}
                  numberOfLines={1}
                >
                  {locName}
                </Text>
              </View>
            ) : null}
          </View>
          <StatusPill
            label={statusLabel}
            backgroundColor={statusColors.backgroundColor}
            textColor={statusColors.textColor}
            borderColor={statusColors.borderColor}
            compact
          />
        </View>

        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.sm }]}>
          {t('rentals.clientRequests.requestedPeriod', 'Requested period')}
        </Text>
        <Text style={[typography.body2, { color: colors.text.primary }]}>
          {selectionWindows.length
            ? `${formatRentalRequestLocalDateTime(selectionWindows[0].start_at)} — ${formatRentalRequestLocalDateTime(selectionWindows[selectionWindows.length - 1].end_at)}`
            : '—'}
        </Text>

        {quote ? (
          <View
            style={[
              styles.quote,
              {
                backgroundColor: colors.success.main + '14',
                borderColor: colors.success.main + '33',
                marginTop: spacing.sm,
              },
            ]}
          >
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('rentals.clientRequests.quotedTotal', 'Quoted total')}
            </Text>
            <Text style={[typography.subtitle1, { color: colors.success.dark }]}>
              {formatRentalMoney(quote.total, quote.currency)}
            </Text>
          </View>
        ) : null}

        {row.status === 'available' && deadlineIso ? (
          <Text
            style={[
              typography.caption,
              {
                color: canBookNow ? colors.text.secondary : colors.error.main,
                marginTop: spacing.xs,
                fontWeight: canBookNow ? '400' : '600',
              },
            ]}
          >
            {canBookNow
              ? t('rentals.clientRequests.contractCompleteBy', 'Complete booking by {{date}}', {
                  date: formatRentalRequestLocalDateTime(deadlineIso),
                })
              : t(
                  'rentals.clientRequests.contractExpiredHint',
                  'This offer has expired. You can send a new request from the listing.'
                )}
          </Text>
        ) : null}

        {row.status === 'unavailable' && reasonCode ? (
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
            {t('rentals.clientRequests.unavailableReason', 'Reason')}:{' '}
            {t(`rentals.unavailableReasons.${reasonCode}`, reasonCode)}
          </Text>
        ) : null}

        {row.business_response_note?.trim() ? (
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, marginTop: spacing.xs, fontStyle: 'italic' },
            ]}
          >
            {t('rentals.clientRequests.businessNote', 'Business note')}:{' '}
            {row.business_response_note.trim()}
          </Text>
        ) : null}

        <View style={[styles.actions, { marginTop: spacing.sm, gap: spacing.xs }]}>
          {listing?.id ? (
            <Button mode="outlined" compact onPress={() => onViewListing(listing.id)}>
              {t('rentals.clientRequests.viewListing', 'View listing')}
            </Button>
          ) : null}
          {row.status === 'available' ? (
            <>
              <Button
                mode="contained"
                compact
                loading={bookingLoading}
                disabled={bookingLoading || !canBookNow}
                onPress={() => onBookRequest(row.id)}
              >
                {t('rentals.bookNow', 'Book now')}
              </Button>
              <Button
                mode="outlined"
                compact
                textColor={colors.error.main}
                loading={cancelling}
                onPress={() => onCancel(row.id)}
              >
                {t('rentals.clientRequests.cancelOffer', 'Cancel reservation')}
              </Button>
            </>
          ) : null}
          {row.status === 'pending' ? (
            <Button
              mode="outlined"
              compact
              textColor={colors.error.main}
              loading={cancelling}
              onPress={() => onCancel(row.id)}
            >
              {t('rentals.clientRequests.cancelRequest', 'Cancel request')}
            </Button>
          ) : null}
          {row.status === 'booked' && bookingId ? (
            <Button mode="contained" compact onPress={() => onViewBooking(bookingId)}>
              {t('rentals.actions.openBooking', 'Open booking')}
            </Button>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  quote: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
