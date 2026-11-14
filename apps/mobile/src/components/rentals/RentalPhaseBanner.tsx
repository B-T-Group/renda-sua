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
  'rentalInspection.bannerReview':
    'Review the condition report, then accept it to start the rental.',
  'rentalInspection.bannerWaiting':
    'Waiting for the renter to accept the condition report. No PIN is needed.',
};

const REVIEW_PILL = { backgroundColor: '#0A4FB518', textColor: '#0A4FB5', borderColor: '#0A4FB544' };
const WAITING_PILL = { backgroundColor: '#B4530918', textColor: '#B45309', borderColor: '#B4530944' };

function inspectionChipTone(nextStepKey?: string): 'review' | 'waiting' | null {
  if (nextStepKey === 'rentalInspection.bannerWaiting') return 'waiting';
  if (nextStepKey === 'rentalInspection.bannerReview') return 'review';
  return null;
}

interface Props {
  bookingStatus?: string | null;
  requestStatus?: string | null;
  role: RentalPhaseRole;
  /** Detail screens pass the pill label so awaiting return is not the phase name. */
  chipLabel?: string;
  /** Replaces the status next-step when an inspected rental does not use a PIN. */
  nextStepKey?: string;
  action?: React.ReactNode;
}

export function RentalPhaseBanner({
  bookingStatus,
  requestStatus,
  role,
  chipLabel,
  nextStepKey,
  action,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const info =
    bookingStatus != null && bookingStatus !== ''
      ? resolveBookingPhase(bookingStatus, role)
      : resolveRentalPhase({ requestStatus, bookingStatus }, role);

  const stepKey = nextStepKey ?? info.nextStepKey;
  const tone = inspectionChipTone(nextStepKey);
  const toneColors = tone === 'waiting' ? WAITING_PILL : tone === 'review' ? REVIEW_PILL : null;
  if (!stepKey && info.phase === 'done' && !bookingStatus) {
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
          label={chipLabel || t(info.labelKey, PHASE_DEFAULTS[info.labelKey] ?? info.phase)}
          backgroundColor={toneColors?.backgroundColor ?? phaseColors.backgroundColor}
          textColor={toneColors?.textColor ?? phaseColors.textColor}
          borderColor={toneColors?.borderColor ?? phaseColors.borderColor}
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
      {stepKey ? (
        <Text style={[typography.body2, { color: colors.text.primary }]}>
          {t(stepKey, NEXT_STEP_DEFAULTS[stepKey] ?? '')}
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
