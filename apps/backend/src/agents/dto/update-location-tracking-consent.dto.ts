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

export class UpdateLocationTrackingConsentDto {
  @ApiProperty({
    enum: ['accepted_fg', 'accepted_bg', 'rejected', 'deferred', 'not_shown'],
    example: 'accepted_fg',
  })
  @IsNotEmpty()
  @IsIn(AGENT_LOCATION_TRACKING_CONSENT_VALUES)
  consent!: AgentLocationTrackingConsent;
}
