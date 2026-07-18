import React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import {
  resolveBookingPhase,
  resolveRentalPhase,
  type RentalPhaseRole,
} from '../../utils/rentalPhase';

const PHASE_DEFAULTS: Record<string, string> = {
  'rentals.phases.requested': 'Requested',
  'rentals.phases.offerReady': 'Offer ready',
  'rentals.phases.reserved': 'Reserved — pay at pickup',
  'rentals.phases.readyForPickup': 'Ready for pickup',
  'rentals.phases.inProgress': 'In progress',
  'rentals.phases.done': 'Done',
};

const NEXT_STEP_DEFAULTS: Record<string, string> = {
  'rentals.nextStep.requestedClient':
    'Waiting for the business to respond to your request.',
  'rentals.nextStep.requestedBusiness':
    'Review this request and accept or decline.',
  'rentals.nextStep.offerReadyClient': 'Book this offer to reserve your rental.',
  'rentals.nextStep.offerReadyBusiness':
    'Waiting for the client to complete booking.',
  'rentals.nextStep.proposedClient': 'Complete payment to confirm this booking.',
  'rentals.nextStep.proposedBusiness': 'Waiting for the client to complete payment.',
  'rentals.nextStep.reservedClient':
    'Pay the rental total at pickup to unlock your start PIN.',
  'rentals.nextStep.reservedBusiness':
    'Collect payment at pickup, then verify the start PIN.',
  'rentals.nextStep.confirmedClient':
    'Send your start PIN in chat when you pick up the item.',
  'rentals.nextStep.confirmedBusiness':
    'Verify the client PIN to start the rental at pickup.',
  'rentals.nextStep.activeClient':
    'Your rental is in progress. Return the item by the booked end time.',
  'rentals.nextStep.activeBusiness':
    'Rental in progress. Confirm return when the item is back.',
  'rentals.nextStep.awaitingReturnClient':
    'Please return the item. The business will confirm the return.',
  'rentals.nextStep.awaitingReturnBusiness':
    'Confirm return when the item is back to settle the booking.',
  'rentals.nextStep.completed': 'This rental is complete.',
};

interface Props {
  bookingStatus?: string | null;
  requestStatus?: string | null;
  role: RentalPhaseRole;
  /** Optional primary action rendered under the banner */
  action?: React.ReactNode;
}

export const RentalPhaseBanner: React.FC<Props> = ({
  bookingStatus,
  requestStatus,
  role,
  action,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const info =
    bookingStatus != null && bookingStatus !== ''
      ? resolveBookingPhase(bookingStatus, role)
      : resolveRentalPhase({ requestStatus, bookingStatus }, role);

  if (!info.nextStepKey && info.phase === 'done' && !bookingStatus) {
    return null;
  }

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.info.main, 0.35),
        bgcolor: alpha(theme.palette.info.main, 0.08),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Chip
          size="small"
          label={t(info.labelKey, PHASE_DEFAULTS[info.labelKey] ?? info.phase)}
          color="info"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
        <Typography variant="caption" color="info.main" fontWeight={700}>
          {t('rentals.nextStep.label', 'Next step')}
        </Typography>
      </Stack>
      {info.nextStepKey ? (
        <Typography variant="body2" color="text.primary">
          {t(info.nextStepKey, NEXT_STEP_DEFAULTS[info.nextStepKey] ?? '')}
        </Typography>
      ) : null}
      {action}
    </Stack>
  );
};

export default RentalPhaseBanner;
