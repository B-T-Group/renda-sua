import { HttpException, HttpStatus } from '@nestjs/common';
import type { AgentLocationTrackingConsent } from './dto/update-location-tracking-consent.dto';

const ALLOWED_TRANSITIONS: Record<
  AgentLocationTrackingConsent,
  AgentLocationTrackingConsent[]
> = {
  not_shown: ['accepted_fg', 'accepted_bg', 'rejected', 'deferred'],
  accepted_fg: ['accepted_bg', 'rejected'],
  accepted_bg: ['accepted_fg', 'rejected'],
  rejected: ['not_shown'],
  deferred: ['accepted_fg', 'accepted_bg', 'rejected', 'not_shown'],
};

export function assertLocationConsentTransition(
  current: AgentLocationTrackingConsent,
  next: AgentLocationTrackingConsent
): void {
  if (current === next) {
    return;
  }
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new HttpException(
      {
        success: false,
        error: `Cannot transition location_tracking_consent from ${current} to ${next}`,
      },
      HttpStatus.BAD_REQUEST
    );
  }
}
