import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/common/StatusPill';
import { useTheme } from '@/contexts/ThemeContext';
import {
  resolveBookingPhase,
  resolveRentalPhase,
  type RentalPhaseRole,
} from '@/utils/rentals/rentalPhase';
import { rentalPhaseColors } from '@/utils/rentals/rentalPhaseColors';

const PHASE_DEFAULTS: Record<string, string> = {
  'rentals.phases.requested': 'Requested',
  'rentals.phases.offerReady': 'Offer ready',
  'rentals.phases.reserved': 'Reserved',
  'rentals.phases.readyForPickup': 'Ready for pickup',
  'rentals.phases.inProgress': 'In progress',
  'rentals.phases.done': 'Done',
};

export interface RentalPhaseStatusPillProps {
  requestStatus?: string | null;
  bookingStatus?: string | null;
  role?: RentalPhaseRole;
  compact?: boolean;
}

/** Status pill using the unified rental phase vocabulary (not raw backend status strings). */
export function RentalPhaseStatusPill({
  requestStatus,
  bookingStatus,
  role = 'client',
  compact = true,
}: RentalPhaseStatusPillProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const info =
    bookingStatus != null && bookingStatus !== ''
      ? resolveBookingPhase(bookingStatus, role)
      : resolveRentalPhase({ requestStatus, bookingStatus }, role);

  const phaseColors = rentalPhaseColors(info.phase, colors);

  return (
    <StatusPill
      compact={compact}
      label={t(info.labelKey, PHASE_DEFAULTS[info.labelKey] ?? info.phase)}
      backgroundColor={phaseColors.backgroundColor}
      textColor={phaseColors.textColor}
      borderColor={phaseColors.borderColor}
    />
  );
}
