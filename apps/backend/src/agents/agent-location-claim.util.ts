import { HttpException, HttpStatus } from '@nestjs/common';
import {
  LOCATION_CONSENT_PLATFORMS,
  type LocationConsentPlatform,
} from '../agents/dto/update-location-tracking-consent.dto';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export const RENDASUA_PLATFORM_HEADER = 'x-rendasua-platform';

export function parseLocationConsentPlatformHeader(
  value: string | undefined
): LocationConsentPlatform | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return (LOCATION_CONSENT_PLATFORMS as readonly string[]).includes(normalized)
    ? (normalized as LocationConsentPlatform)
    : undefined;
}

export async function assertMobileLocationConsentAccepted(
  hasuraSystemService: HasuraSystemService,
  agentId: string,
  platformHeader: string | undefined
): Promise<void> {
  const platform = parseLocationConsentPlatformHeader(platformHeader);
  if (!platform || platform === 'web') {
    return;
  }
  const consent = await hasuraSystemService.getAgentLocationConsent(
    agentId,
    platform
  );
  if (consent !== 'accepted') {
    throw new HttpException(
      {
        success: false,
        error:
          'Location tracking consent is required to claim orders. Accept location disclosure and enable location permissions in the app.',
        errorCode: 'LOCATION_CONSENT_REQUIRED',
      },
      HttpStatus.FORBIDDEN
    );
  }
}
