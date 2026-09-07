import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import {
  resolveBookingPhase,
  resolveRentalPhase,
  type RentalPhaseRole,
} from '../../utils/rentals/rentalPhase';
import { rentalPhaseColors } from '../../utils/rentals/rentalPhaseColors';

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
  action?: React.ReactNode;
}

export function RentalPhaseBanner({
  bookingStatus,
  requestStatus,
  role,
  action,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const info =
    bookingStatus != null && bookingStatus !== ''
      ? resolveBookingPhase(bookingStatus, role)
      : resolveRentalPhase({ requestStatus, bookingStatus }, role);

  if (!info.nextStepKey && info.phase === 'done' && !bookingStatus) {
    return null;
  }

  const phaseColors = rentalPhaseColors(info.phase, colors);

  return (
    <View
      style={[
        styles.box,
        {
          borderColor: colors.info.main + '55',
          backgroundColor: colors.info.main + '14',
          borderRadius: borderRadius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
      accessibilityRole="text"
    >
      <View style={styles.row}>
        <StatusPill
          label={t(info.labelKey, PHASE_DEFAULTS[info.labelKey] ?? info.phase)}
          backgroundColor={phaseColors.backgroundColor}
          textColor={phaseColors.textColor}
          borderColor={phaseColors.borderColor}
        />
        <Text
          style={[
            typography.caption,
            { color: colors.info.main, fontWeight: '700', marginLeft: spacing.sm },
          ]}
        >
          {t('rentals.nextStep.label', 'Next step')}
        </Text>
      </View>
      {info.nextStepKey ? (
        <Text style={[typography.body2, { color: colors.text.primary }]}>
          {t(info.nextStepKey, NEXT_STEP_DEFAULTS[info.nextStepKey] ?? '')}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
