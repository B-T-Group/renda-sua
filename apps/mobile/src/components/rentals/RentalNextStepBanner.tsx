import React from 'react';
import { RentalPhaseBanner } from './RentalPhaseBanner';
import type { RentalPhaseRole } from '../../utils/rentals/rentalPhase';

interface Props {
  status: string;
  role: RentalPhaseRole;
}

/** @deprecated Prefer RentalPhaseBanner with bookingStatus */
export function RentalNextStepBanner({ status, role }: Props) {
  return <RentalPhaseBanner bookingStatus={status} role={role} />;
}
