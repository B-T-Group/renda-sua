import { HttpException, HttpStatus } from '@nestjs/common';
import {
  AGENT_LOCATION_TRACKING_CONSENT_VALUES,
  type AgentLocationTrackingConsent,
} from './dto/update-location-tracking-consent.dto';

export function normalizeAgentLocationTrackingConsent(
  value: unknown
): AgentLocationTrackingConsent {
  if (
    typeof value === 'string' &&
    (AGENT_LOCATION_TRACKING_CONSENT_VALUES as readonly string[]).includes(value)
  ) {
    return value as AgentLocationTrackingConsent;
  }
  return 'not_shown';
}

const ALLOWED_TRANSITIONS: Record<
  AgentLocationTrackingConsent,
  AgentLocationTrackingConsent[]
> = {
  not_shown: ['accepted', 'deferred'],
  deferred: ['accepted'],
  accepted: [],
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
