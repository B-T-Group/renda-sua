import { useContext } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { IconButton, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientRentalRequestRow } from '../../types/rentals';
import {
  formatRentalMoney,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
  proposedContractDeadlineIso,
} from '../../utils/rentals';
import { formatConfirmationMoney } from '../../utils/rentals/confirmationFormat';
import { reservationFee, reserveMode, type ReserveMode } from '../../utils/rentals/reservationFee';
import { buildReserveSummary, clockTime, reserveZone, weekdayDay, windowLabel } from '../../utils/rentals/reserveSummary';
import { ReserveStickyBar } from './ReserveStickyBar';
import { ReserveSummaryView } from './ReserveSummaryView';

export interface RentalBookConfirmSheetProps {
  visible: boolean;
  row: ClientRentalRequestRow | null;
  loading?: boolean;
  isStripeRail?: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}

type SummaryRow = { key: string; label: string; value: string };

export function RentalBookConfirmSheet({
  visible,
  row,
  loading,
  isStripeRail,
  onDismiss,
  onConfirm,
}: RentalBookConfirmSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };

  if (!row) return null;

  const listing = row.rental_location_listing;
  const itemName =
    listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const deadlineIso = proposedContractDeadlineIso(row);
  const selectionWindows = parseRentalSelectionWindows(row.rental_selection_windows);
  const zone = reserveZone({
    listingZone: row.listing_timezone,
    country: listing?.business_location?.address?.country,
    quote,
  });
  // Listing clock with weekdays (B3): "Sat 28 Nov · 14:00–18:00" / "2:00–6:00 PM".
  const envelopePeriod = selectionWindows.length
    ? selectionWindows.length === 1
      ? windowLabel(selectionWindows[0], i18n.language, zone)
      : `${windowLabel(selectionWindows[0], i18n.language, zone)} – ${windowLabel(selectionWindows[selectionWindows.length - 1], i18n.language, zone)}`
    : '—';
  const deadlineLabel = deadlineIso ? `${weekdayDay(deadlineIso, i18n.language, zone)} · ${clockTime(deadlineIso, i18n.language, zone, zone)}` : '';
  const mode = reserveMode(row.rental_booking, isStripeRail);
  const fee = reservationFee(row.rental_booking);
  const feeLabel = quote ? formatConfirmationMoney(fee, quote.currency, i18n.language) : String(fee);
  const payAtPickup = mode !== 'card_upfront';
  const summary = payAtPickup
    ? buildReserveSummary({
        mode,
        windows: selectionWindows,
        quote,
        booking: row.rental_booking,
        listingZone: row.listing_timezone,
        country: listing?.business_location?.address?.country,
        placeName: locName,
        city: listing?.business_location?.address?.city,
        deadlineIso,
        isStripeRail,
        language: i18n.language,
        t,
      })
    : null;
  const business = listing?.rental_item?.business?.name || locName;
  const detailRows = buildSummaryRows({
    mode,
    fee,
    language: i18n.language,
    t,
    itemName,
    locName,
    envelopePeriod,
    quote,
    deadlineLabel,
    isStripeRail,
  });

  const confirmLabel = summary
    ? summary.button
    : isStripeRail
      ? t('rentals.clientRequests.bookConfirmButtonStripe', 'Continue to payment')
      : t('rentals.clientRequests.bookConfirmButtonReserve', 'Reserve now');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onDismiss}>
      <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingHorizontal: spacing.xs, borderBottomColor: colors.divider }]}>
          <IconButton
            testID="book-confirm-close"
            icon="close"
            onPress={onDismiss}
            disabled={loading}
            accessibilityLabel={t('common.close', 'Close')}
          />
          <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700', flex: 1 }]}>
            {t('rentals.clientRequests.bookConfirmTitle', 'Review and confirm your reservation')}
          </Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: spacing.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {summary ? (
            <ReserveSummaryView
              summary={summary}
              itemName={itemName}
              business={business ? t('rentals.reserve.offerFrom', 'Offer accepted by {{business}}', { business }) : null}
            />
          ) : (
            <>
            <Text testID="book-confirm-message" style={[typography.body2, { color: colors.text.secondary }]}>
              {mode === 'free'
                ? t(
                    'rentals.payAtPickup.reserveFreeBody',
                    'Nothing to pay today. At pickup, the business shows you the item, you check it, then you pay and take it. Free cancellation before the rental starts.'
                  )
                : mode === 'fee'
                  ? t(
                      'rentals.payAtPickup.reserveFeeBody',
                      'Pay a {{fee}} reservation fee now to hold the item. It counts toward your total. You pay the rest at pickup, after you check the item.',
                      { fee: feeLabel }
                    )
                  : isStripeRail
                ? t(
                    'rentals.clientRequests.bookConfirmMessageStripe',
                    'By continuing, the rental total plus the security deposit is held on your card — nothing is charged until the item is returned, and the final charge is at least the rental total. Free cancellation before the rental starts.'
                  )
                : t(
                    'rentals.clientRequests.bookConfirmMessage',
                    'By continuing, your reservation is held for free — no payment now. You pay the rental total at pickup (wallet or mobile money). Free cancellation before the rental starts.'
                  )}
            </Text>
            <Text
              style={[
                typography.caption,
                {
                  color: colors.primary.main,
                  fontWeight: '800',
                  marginTop: spacing.md,
                  letterSpacing: 0.5,
                },
              ]}
            >
              {t(
                'rentals.clientRequests.bookConfirmSummaryHeading',
                'Reservation summary'
              )}
            </Text>
            {mode === 'fee' ? (
              <View testID="book-confirm-fee-rules" style={{ marginTop: spacing.sm, gap: 4 }}>
                <RuleLine
                  icon="cash-refund"
                  text={t('rentals.payAtPickup.feeRefundedOffer', 'Fee refunded if you cancel before the pickup day, if the business cancels, or if the item doesn’t match.')}
                />
                <RuleLine
                  icon="alert-circle-outline"
                  text={t('rentals.payAtPickup.feeKept', 'Fee kept if you cancel on the pickup day or don’t come.')}
                />
              </View>
            ) : null}
            {detailRows.map((rowItem, idx) => (
              <DetailRow
                key={rowItem.key}
                label={rowItem.label}
                value={rowItem.value}
                showDivider={idx < detailRows.length - 1}
              />
            ))}
            </>
          )}
        </ScrollView>
        <ReserveStickyBar
          summary={summary}
          confirmLabel={confirmLabel}
          confirmIcon={mode === 'fee' ? 'lock-outline' : mode === 'free' ? 'calendar-blank-outline' : undefined}
          loading={loading}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      </View>
    </Modal>
  );
}

function buildSummaryRows(params: {
  mode: ReserveMode;
  fee: number;
  language: string;
  t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string;
  itemName: string;
  locName?: string | null;
  envelopePeriod: string;
  quote: ReturnType<typeof parseRentalPricingSnapshot>;
  deadlineLabel: string;
  isStripeRail?: boolean;
}): SummaryRow[] {
  const { t, itemName, locName, envelopePeriod, quote, deadlineLabel, isStripeRail, mode, fee, language } =
    params;
  const rows: SummaryRow[] = [
    {
      key: 'item',
      label: t('rentals.clientRequests.bookConfirmLabelItem', 'Item'),
      value: itemName,
    },
    {
      key: 'location',
      label: t('rentals.clientRequests.bookConfirmLabelLocation', 'Pickup location'),
      value: locName?.trim() || '—',
    },
    {
      key: 'period',
      label: t('rentals.clientRequests.bookConfirmLabelPeriod', 'Rental period'),
      value: envelopePeriod,
    },
  ];
  if (mode === 'card_upfront') appendQuoteRows(rows, t, quote, isStripeRail);
  else appendPayAtPickupRows(rows, t, quote, mode, fee, language, isStripeRail);
  if (deadlineLabel) {
    rows.push({
      key: 'deadline',
      label: t('rentals.clientRequests.bookConfirmLabelAcceptBy', 'Offer valid until'),
      value: deadlineLabel,
    });
  }
  return rows;
}

function appendQuoteRows(
  rows: SummaryRow[],
  t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string,
  quote: ReturnType<typeof parseRentalPricingSnapshot>,
  isStripeRail?: boolean
): void {
  if (!quote) return;
  quote.lines?.forEach((line, idx) => {
    rows.push({
      key: `line-${idx}`,
      label:
        line.kind === 'all_day'
          ? t('rentals.clientRequests.lineAllDay', 'Full day {{date}}', {
              date: line.calendarDate,
            })
          : t('rentals.clientRequests.lineHourly', '{{h}} h × {{rate}}', {
              h: line.billableHours,
              rate: formatRentalMoney(line.ratePerHour, quote.currency),
            }),
      value: formatRentalMoney(line.subtotal, quote.currency),
    });
  });
  rows.push({
    key: 'total',
    label: t('rentals.clientRequests.bookConfirmLabelTotal', 'Quoted total'),
    value: formatRentalMoney(quote.total, quote.currency),
  });
  if (!isStripeRail || !quote.securityDeposit) return;
  rows.push({
    key: 'deposit',
    label: t('rentals.clientRequests.bookConfirmLabelDeposit', 'Security deposit'),
    value: formatRentalMoney(quote.securityDeposit, quote.currency),
  });
  rows.push({
    key: 'held',
    label: t('rentals.clientRequests.bookConfirmLabelHeldOnCard', 'Held on card'),
    value: formatRentalMoney(quote.total + quote.securityDeposit, quote.currency),
  });
}

/** Reserve now, pay at pickup: the fee (if any) now, the rest at pickup, the card deposit at pickup. */
function appendPayAtPickupRows(
  rows: SummaryRow[],
  t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string,
  quote: ReturnType<typeof parseRentalPricingSnapshot>,
  mode: ReserveMode,
  fee: number,
  language: string,
  isStripeRail?: boolean
): void {
  if (!quote) return;
  const money = (value: number) => formatConfirmationMoney(value, quote.currency, language);
  rows.push({
    key: 'total',
    label: t('rentals.clientRequests.bookConfirmLabelTotal', 'Quoted total'),
    value: money(quote.total),
  });
  const now = mode === 'fee' ? Math.min(fee, quote.total) : 0;
  rows.push({
    key: 'now',
    label:
      mode === 'fee'
        ? t('rentals.payAtPickup.feeNowLabel', 'Reservation fee today · counts toward your total')
        : t('rentals.payAtPickup.nothingToday', 'To pay today'),
    value: money(now),
  });
  const rest = quote.total - now;
  rows.push({
    key: 'due',
    label: t('rentals.payAtPickup.dueAfterCheck', 'Due at pickup, after the item check'),
    value: money(quote.currency.toUpperCase() === 'XAF' || quote.currency.toUpperCase() === 'XOF' ? Math.round(rest) : Number(rest.toFixed(2))),
  });
  if (!isStripeRail || !quote.securityDeposit) return;
  rows.push({
    key: 'deposit',
    label: t('rentals.payAtPickup.depositAtPickup', 'Deposit hold on your card at pickup'),
    value: money(quote.securityDeposit),
  });
}

function RuleLine({ icon, text }: { icon: 'cash-refund' | 'alert-circle-outline'; text: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.text.secondary} style={{ marginTop: 1 }} />
      <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 6, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  showDivider,
}: {
  label: string;
  value: string;
  showDivider: boolean;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        borderBottomColor: colors.divider,
        borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={[typography.caption, { color: colors.text.secondary, fontWeight: '700' }]}>
        {label}
      </Text>
      <Text style={[typography.body2, { color: colors.text.primary, fontWeight: '600' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    flex: 1,
  },
});
