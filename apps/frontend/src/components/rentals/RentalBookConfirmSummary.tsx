import { Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientRentalRequestRow } from '../../hooks/useRentalApi';
import type { RentalPricingSnapshotLine } from '../../hooks/useRentalApi';
import {
  formatRentalMoney,
  formatRentalRequestLocalDateTime,
  parseRentalPricingSnapshot,
  proposedContractDeadlineIso,
} from '../../utils/rentalRequestDisplay';

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

export interface RentalBookConfirmSummaryProps {
  row: ClientRentalRequestRow;
}

export const RentalBookConfirmSummary: React.FC<RentalBookConfirmSummaryProps> = ({
  row,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const listing = row.rental_location_listing;
  const itemName =
    listing?.rental_item?.name ?? t('rentals.clientRequests.unknownItem', 'Rental');
  const locName = listing?.business_location?.name;
  const quote = parseRentalPricingSnapshot(row.rental_pricing_snapshot);
  const deadlineIso = proposedContractDeadlineIso(row);

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
          value={`${formatRentalRequestLocalDateTime(row.requested_start_at)} — ${formatRentalRequestLocalDateTime(row.requested_end_at)}`}
        />
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
    </Paper>
  );
};
