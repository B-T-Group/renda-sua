import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export const AGENT_LOCATION_TRACKING_CONSENT_VALUES = [
  'not_shown',
  'accepted_fg',
  'accepted_bg',
  'rejected',
  'deferred',
] as const;

export type AgentLocationTrackingConsent =
  (typeof AGENT_LOCATION_TRACKING_CONSENT_VALUES)[number];

export const LOCATION_CONSENT_PLATFORMS = ['ios', 'android'] as const;

export type LocationConsentPlatform =
  (typeof LOCATION_CONSENT_PLATFORMS)[number];

export class UpdateLocationTrackingConsentDto {
  @ApiProperty({
    enum: ['accepted_fg', 'accepted_bg', 'rejected', 'deferred', 'not_shown'],
    example: 'accepted_fg',
  })
  @IsNotEmpty()
  @IsIn(AGENT_LOCATION_TRACKING_CONSENT_VALUES)
  consent!: AgentLocationTrackingConsent;

  @ApiProperty({ enum: LOCATION_CONSENT_PLATFORMS, example: 'ios' })
  @IsNotEmpty()
  @IsIn(LOCATION_CONSENT_PLATFORMS)
  platform!: LocationConsentPlatform;
}

export class ResetLocationTrackingDisclosureDto {
  @ApiProperty({ enum: LOCATION_CONSENT_PLATFORMS, example: 'android' })
  @IsNotEmpty()
  @IsIn(LOCATION_CONSENT_PLATFORMS)
  platform!: LocationConsentPlatform;
}
