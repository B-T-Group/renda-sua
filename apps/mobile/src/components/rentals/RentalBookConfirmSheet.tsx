import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientRentalRequestRow } from '../../types/rentals';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  parseRentalPricingSnapshot,
  parseRentalSelectionWindows,
  proposedContractDeadlineIso,
} from '../../utils/rentals';

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
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { width, height } = useWindowDimensions();

  if (!row) return null;

  const listing = row.rental_location_listing;
  const itemName =
    listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const deadlineIso = proposedContractDeadlineIso(row);
  const selectionWindows = parseRentalSelectionWindows(row.rental_selection_windows);
  const envelopePeriod = selectionWindows.length
    ? `${formatRentalRequestLocalDateTime(selectionWindows[0].start_at)} — ${formatRentalRequestLocalDateTime(selectionWindows[selectionWindows.length - 1].end_at)}`
    : '—';
  const detailRows = buildSummaryRows({
    t,
    itemName,
    locName,
    envelopePeriod,
    quote,
    deadlineIso,
    isStripeRail,
  });

  const cardWidth = Math.min(width - spacing.lg * 2, 420);

  return (
    <Portal>
      {/*
        Paper Dialog uses Surface (extra elevation layer on iOS → double bottom
        edge). Style the Modal content container itself as the only card.
      */}
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.card,
          shadows.md,
          {
            width: cardWidth,
            maxHeight: height * 0.85,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
          },
        ]}
      >
        <Text
          style={[
            typography.subtitle1,
            {
              color: colors.text.primary,
              fontWeight: '700',
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
            },
          ]}
        >
          {t(
            'rentals.clientRequests.bookConfirmTitle',
            'Review and confirm your reservation'
          )}
        </Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[typography.body2, { color: colors.text.secondary }]}>
            {isStripeRail
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
          {detailRows.map((rowItem, idx) => (
            <DetailRow
              key={rowItem.key}
              label={rowItem.label}
              value={rowItem.value}
              showDivider={idx < detailRows.length - 1}
            />
          ))}
        </ScrollView>
        <View
          style={[
            styles.actions,
            {
              borderTopColor: colors.divider,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <Button onPress={onDismiss} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button loading={loading} onPress={onConfirm}>
            {isStripeRail
              ? t(
                  'rentals.clientRequests.bookConfirmButtonStripe',
                  'Continue to payment'
                )
              : t(
                  'rentals.clientRequests.bookConfirmButtonReserve',
                  'Reserve now'
                )}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

function buildSummaryRows(params: {
  t: (key: string, defaultValue: string, opts?: Record<string, unknown>) => string;
  itemName: string;
  locName?: string | null;
  envelopePeriod: string;
  quote: ReturnType<typeof parseRentalPricingSnapshot>;
  deadlineIso: string | null;
  isStripeRail?: boolean;
}): SummaryRow[] {
  const { t, itemName, locName, envelopePeriod, quote, deadlineIso, isStripeRail } =
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
  appendQuoteRows(rows, t, quote, isStripeRail);
  if (deadlineIso) {
    rows.push({
      key: 'deadline',
      label: t('rentals.clientRequests.bookConfirmLabelAcceptBy', 'Offer valid until'),
      value: formatRentalRequestLocalDateTime(deadlineIso),
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
  card: {
    overflow: 'hidden',
  },
  scroll: {
    flexGrow: 0,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
