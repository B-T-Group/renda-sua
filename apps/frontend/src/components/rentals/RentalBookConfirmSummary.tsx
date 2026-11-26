import { Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientRentalRequestRow } from '../../hooks/useRentalApi';
import type { RentalPricingSnapshotLine } from '../../hooks/useRentalApi';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  parseRentalSelectionWindows,
  parseRentalPricingSnapshot,
  proposedContractDeadlineIso,
} from '../../utils/rentalRequestDisplay';
import { formatConfirmationMoney } from '../../utils/rentals/confirmationFormat';
import { reservationFee, reserveMode } from '../../utils/rentals/reservationFee';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.25, sm: 2 }}
      sx={{
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          minWidth: { sm: 152 },
          fontWeight: 700,
          letterSpacing: 0.04,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, lineHeight: 1.5 }}>
        {value}
      </Typography>
    </Stack>
  );
}

/** Reserve now, pay at pickup: the fee (if any) today, the rest at pickup, the card deposit at pickup. */
function PayAtPickupRows(props: {
  mode: 'free' | 'fee';
  fee: number;
  total: number;
  deposit: number;
  format: (value: number) => string;
}) {
  const { t } = useTranslation();
  const now = props.mode === 'fee' ? Math.min(props.fee, props.total) : 0;
  const rest = Math.round((props.total - now) * 100) / 100;
  return (
    <>
      <DetailRow
        label={
          props.mode === 'fee'
            ? t('rentals.payAtPickup.feeNowLabel', 'Reservation fee today · counts toward your total')
            : t('rentals.payAtPickup.nothingToday', 'To pay today')
        }
        value={props.format(now)}
      />
      <DetailRow label={t('rentals.payAtPickup.dueAfterCheck', 'Due at pickup, after the item check')} value={props.format(rest)} />
      {props.deposit > 0 ? (
        <DetailRow label={t('rentals.payAtPickup.depositAtPickup', 'Deposit hold on your card at pickup')} value={props.format(props.deposit)} />
      ) : null}
      {props.mode === 'fee' ? (
        <Stack spacing={0.5} sx={{ pt: 1 }} data-testid="book-confirm-fee-rules">
          <Typography variant="caption" color="text.secondary">
            {t('rentals.payAtPickup.feeRefundedOffer', 'Fee refunded if you cancel before the pickup day, if the business cancels, or if the item doesn’t match.')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('rentals.payAtPickup.feeKept', 'Fee kept if you cancel on the pickup day or don’t come.')}
          </Typography>
        </Stack>
      ) : null}
    </>
  );
}

export interface RentalBookConfirmSummaryProps {
  row: ClientRentalRequestRow;
  /** Card rail shows the deposit/authorization terms; other rails show pay-at-pickup. */
  isStripeRail?: boolean;
}

export const RentalBookConfirmSummary: React.FC<RentalBookConfirmSummaryProps> = ({
  row,
  isStripeRail,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const mode = reserveMode(row.rental_booking, isStripeRail);
  const fee = reservationFee(row.rental_booking);
  const listing = row.rental_location_listing;
  const itemName =
    listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const deadlineIso = proposedContractDeadlineIso(row);
  const selectionWindows = parseRentalSelectionWindows(row.rental_selection_windows);
  const envelopePeriod = selectionWindows.length
    ? `${formatRentalRequestLocalDateTime(selectionWindows[0].start_at)} — ${formatRentalRequestLocalDateTime(selectionWindows[selectionWindows.length - 1].end_at)}`
    : t('rentals.clientRequests.unknownPeriod', 'Requested period unavailable');

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.2),
        bgcolor: alpha(theme.palette.primary.main, 0.04),
      }}
    >
      <Typography variant="overline" color="primary" fontWeight={800} sx={{ letterSpacing: 0.08 }}>
        {t('rentals.clientRequests.bookConfirmSummaryHeading', 'Reservation summary')}
      </Typography>
      <Divider sx={{ my: 1.5, borderColor: alpha(theme.palette.primary.main, 0.15) }} />
      <Stack spacing={0}>
        <DetailRow
          label={t('rentals.clientRequests.bookConfirmLabelItem', 'Item')}
          value={itemName}
        />
        <DetailRow
          label={t('rentals.clientRequests.bookConfirmLabelLocation', 'Pickup location')}
          value={locName?.trim() || '—'}
        />
        <DetailRow
          label={t('rentals.clientRequests.bookConfirmLabelPeriod', 'Rental period')}
          value={envelopePeriod}
        />
        {selectionWindows.map((window, idx) => (
          <DetailRow
            key={`${window.start_at}-${window.end_at}-${idx}`}
            label={t('rentals.clientRequests.bookConfirmLabelWindow', 'Window {{index}}', {
              index: idx + 1,
            })}
            value={`${formatRentalRequestLocalDateTime(window.start_at)} — ${formatRentalRequestLocalDateTime(window.end_at)}`}
          />
        ))}
        {quote?.lines?.length ? (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ pt: 1 }}>
              {t('rentals.clientRequests.bookConfirmLabelBreakdown', 'Price breakdown')}
            </Typography>
            {quote.lines.map((line: RentalPricingSnapshotLine, idx: number) => (
              <DetailRow
                key={idx}
                label={
                  line.kind === 'all_day'
                    ? t('rentals.clientRequests.lineAllDay', 'Full day {{date}}', {
                        date: line.calendarDate,
                      })
                    : t('rentals.clientRequests.lineHourly', '{{h}} h × {{rate}}', {
                        h: line.billableHours,
                        rate: formatRentalMoney(line.ratePerHour, quote.currency),
                      })
                }
                value={formatRentalMoney(line.subtotal, quote.currency)}
              />
            ))}
          </>
        ) : null}
        {quote ? (
          <DetailRow
            label={t('rentals.clientRequests.bookConfirmLabelTotal', 'Quoted total')}
            value={formatRentalMoney(quote.total, quote.currency)}
          />
        ) : null}
        {quote && mode !== 'card_upfront' ? (
          <PayAtPickupRows
            mode={mode}
            fee={fee}
            total={quote.total}
            deposit={isStripeRail ? Number(quote.securityDeposit) || 0 : 0}
            format={(value) => formatConfirmationMoney(value, quote.currency, i18n.language)}
          />
        ) : null}
        {mode === 'card_upfront' && isStripeRail && quote?.securityDeposit ? (
          <DetailRow
            label={t(
              'rentals.clientRequests.bookConfirmLabelDeposit',
              'Security deposit'
            )}
            value={formatRentalMoney(quote.securityDeposit, quote.currency)}
          />
        ) : null}
        {deadlineIso ? (
          <DetailRow
            label={t('rentals.clientRequests.bookConfirmLabelAcceptBy', 'Offer valid until')}
            value={formatRentalRequestLocalDateTime(deadlineIso)}
          />
        ) : null}
      </Stack>
      {row.business_response_note?.trim() ? (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
            {t('rentals.clientRequests.businessNote', 'Business note')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
            {row.business_response_note.trim()}
          </Typography>
        </>
      ) : null}
      <Divider sx={{ my: 1.5 }} />
      <Stack spacing={0.75}>
        {isStripeRail && quote?.securityDeposit ? (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {t(
              row.rental_booking?.inspection_policy_version != null
                ? 'rentals.clientRequests.paymentTermsCardInspected'
                : 'rentals.clientRequests.paymentTermsCard',
              row.rental_booking?.inspection_policy_version != null
                ? 'Card payments: {{authorized}} is held on your card (rental + deposit). The rental is charged at return. The deposit is released unless there\'s damage or a late return. Booking must end within 6 days.'
                : 'Card payments: {{authorized}} is held on your card (rental + deposit). The deposit only covers extra hours past your booked end time — the final charge at return is at least the rental total. Booking must end within 6 days.',
              {
                authorized: formatRentalMoney(
                  (quote?.total ?? 0) + (quote?.securityDeposit ?? 0),
                  quote?.currency ?? 'XAF'
                ),
              }
            )}
          </Typography>
        ) : null}
        {!isStripeRail ? (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {t(
              'rentals.clientRequests.paymentTermsPickup',
              'Mobile money / wallet: reserve now for free and pay the rental total at pickup.'
            )}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {t(
            'rentals.clientRequests.freeCancelBeforeStart',
            'Free cancellation any time before the rental starts.'
          )}
        </Typography>
      </Stack>
    </Paper>
  );
};
