import { Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { BusinessReturnConfirmationRow } from '../../hooks/useRentalApi';
import { buildReturnCardModel } from '../../utils/dashboardReturnConfirmations';
import { RentalItemThumb } from './RentalItemThumb';

export function BusinessDashboardReturnConfirmationCard({
  row,
  busy,
  onOpen,
  onConfirm,
  onProblem,
}: {
  row: BusinessReturnConfirmationRow;
  busy: boolean;
  onOpen: (row: BusinessReturnConfirmationRow) => void;
  onConfirm: (row: BusinessReturnConfirmationRow) => void;
  onProblem: (row: BusinessReturnConfirmationRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const model = buildReturnCardModel(row, i18n.language);
  return (
    <Box
      data-testid="dashboard-return-card"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5,
        alignItems: { xs: 'stretch', sm: 'center' },
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Box
        component="button"
        type="button"
        data-testid="dashboard-return-open"
        aria-label={t('business.dashboard.rentalReturns.openBooking', 'Open booking')}
        onClick={() => onOpen(row)}
        sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: 0, p: 0, border: 0, bgcolor: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
      >
        <RentalItemThumb item={row.rental_location_listing.rental_item} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" fontWeight={700} color="warning.dark">
            {t('business.dashboard.rentalReturns.chip', 'Return to confirm')}
          </Typography>
          <Typography fontWeight={800} noWrap>{model.itemName}</Typography>
          {model.renterName ? (
            <Typography variant="body2" noWrap>
              {t('business.dashboard.rentalReturns.renter', 'Renter: {{name}}', { name: model.renterName })}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t('business.dashboard.rentalReturns.reported', 'Renter reported the return · {{time}}', { time: model.reportedStamp })}
          </Typography>
        </Box>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
        <Button variant="outlined" color="error" disabled={busy} onClick={() => onProblem(row)} data-testid="dashboard-return-problem" sx={{ minHeight: 44 }}>
          {t('business.dashboard.rentalReturns.reportProblem', 'Report a problem')}
        </Button>
        <Button variant="contained" color="success" disabled={busy} onClick={() => onConfirm(row)} data-testid="dashboard-return-confirm" sx={{ minHeight: 44 }}>
          {t('business.dashboard.rentalReturns.confirm', 'Confirm return')}
        </Button>
      </Stack>
    </Box>
  );
}
