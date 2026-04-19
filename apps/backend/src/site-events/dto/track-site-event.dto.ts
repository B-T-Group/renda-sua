import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { SITE_EVENT_TYPES_V1, type SiteEventTypeV1 } from '../site-event-types';

export class TrackSiteEventDto {
  @ApiProperty({
    enum: SITE_EVENT_TYPES_V1,
    example: 'inventory.cta.buy_now_click',
  })
  @IsIn([...SITE_EVENT_TYPES_V1])
  eventType!: SiteEventTypeV1;

  @ApiProperty({ required: false, example: 'inventory_item' })
  @IsOptional()
  @IsString()
  subjectType?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @ValidateIf((o: TrackSiteEventDto) => o.subjectType != null)
  @IsUUID()
  subjectId?: string;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
