import { AccessTime, CameraAltOutlined, CurrencyExchange, ErrorOutline, InfoOutlined } from '@mui/icons-material';
import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  cardDueAtPickup,
  dueAtPickup,
  feeOutcome,
  pickupDepositHold,
  reservationFee,
  type PayAtPickupFields,
} from '../../utils/rentals/reservationFee';

interface Props {
  booking: PayAtPickupFields;
  format: (value: number) => string;
  /** The business photographs the item and the renter checks it before paying. */
  itemCheck: boolean;
  pickupDay: string;
}

/** Web booking page (09): what is paid, what is due at pickup, and the fee rules. */
export function PayAtPickupPanel({ booking, format, itemCheck, pickupDay }: Props) {
  const { t } = useTranslation();
  const total = Number(booking.total_amount) || 0;
  const fee = reservationFee(booking);
  const outcome = feeOutcome(booking);
  const feePaid = outcome === 'paid' || outcome === 'applied';
  const deposit = cardDueAtPickup(booking) ? pickupDepositHold(booking) : 0;
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }} data-testid="pay-at-pickup-panel">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={800}>
          {t('rentals.payAtPickup.paymentHeading', 'PAYMENT')}
        </Typography>
        <Chip size="small" color="primary" variant="outlined" label={t('rentals.payAtPickup.pill', 'Reserved · pay at pickup')} />
      </Stack>
      <Row label={t('rentals.payAtPickup.rentalTotal', 'Rental total')} value={format(total)} />
      {fee > 0 ? (
        <Row
          label={feePaid ? t('rentals.payAtPickup.feePaid', 'Paid · reservation fee') : t('rentals.payAtPickup.feeWaiting', 'Reservation fee · waiting for payment')}
          value={format(fee)}
          color={feePaid ? 'success.dark' : undefined}
        />
      ) : null}
      <Divider sx={{ my: 0.5 }} />
      <Row label={t('rentals.payAtPickup.dueAfterCheck', 'Due at pickup, after the item check')} value={format(dueAtPickup(booking))} strong />
      {deposit > 0 ? (
        <Row label={t('rentals.payAtPickup.depositAtPickup', 'Deposit hold on your card at pickup')} value={format(deposit)} />
      ) : null}
      <Line icon={<InfoOutlined fontSize="small" />} text={t('rentals.payAtPickup.nothingElse', 'Nothing else is charged until you’ve seen the item.')} />
      {itemCheck ? (
        <Chip
          size="small"
          icon={<CameraAltOutlined />}
          color="primary"
          sx={{ mt: 1, fontWeight: 700 }}
          label={t('rentals.payAtPickup.itemCheck', 'Item check required')}
        />
      ) : null}
      {booking.status === 'reserved' && booking.payment_status !== 'paid' && booking.payment_status !== 'authorized' ? (
        <Line
          icon={<AccessTime fontSize="small" />}
          text={
            fee > 0
              ? oneDot(t('rentals.payAtPickup.comeByFee', 'Come by 23:59 on {{day}}. If you don’t, the reservation is cancelled and the business keeps the fee.', { day: pickupDay }))
              : oneDot(t('rentals.payAtPickup.comeBy', 'Come by 23:59 on {{day}}. If you don’t, the reservation is cancelled.', { day: pickupDay }))
          }
        />
      ) : null}
      {fee > 0 ? (
        <Box sx={{ mt: 1 }}>
          <Line icon={<CurrencyExchange fontSize="small" />} text={t('rentals.payAtPickup.feeRefunded', 'Fee refunded if you cancel before {{day}}, if the business cancels, or if the item doesn’t match.', { day: pickupDay })} />
          <Line icon={<ErrorOutline fontSize="small" />} text={t('rentals.payAtPickup.feeKept', 'Fee kept if you cancel on the pickup day or don’t come.')} />
        </Box>
      ) : null}
    </Paper>
  );
}

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 700} color={color ?? 'text.primary'}>{value}</Typography>
    </Stack>
  );
}

function Line({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 0.75, color: 'text.secondary' }}>
      {icon}
      <Typography variant="caption" color="text.secondary">{text}</Typography>
    </Stack>
  );
}

/** FR abbreviated dates end in a dot ("sam. 28 nov."): don’t double it before the next sentence. */
function oneDot(text: string): string {
  return text.replace(/\.\. /g, '. ');
}
