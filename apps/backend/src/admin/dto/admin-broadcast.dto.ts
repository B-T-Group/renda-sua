import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const BROADCAST_AUDIENCE_TYPES = [
  'everyone',
  'business',
  'agent',
  'client',
  'user',
] as const;
export type BroadcastAudienceType = (typeof BROADCAST_AUDIENCE_TYPES)[number];

export const BROADCAST_TEMPLATE_KEYS = [
  'custom',
  'app_upgrade',
  'business_account_setup',
] as const;
export type BroadcastTemplateKey = (typeof BROADCAST_TEMPLATE_KEYS)[number];

export const BROADCAST_ACTION_TYPES = [
  'generic',
  'app_upgrade',
  'business_account_setup',
] as const;
export type BroadcastActionType = (typeof BROADCAST_ACTION_TYPES)[number];

export const BUSINESS_LIFECYCLE_STATUSES = [
  'created',
  'contract_signed',
  'active',
  'suspended',
] as const;

export class BroadcastAudienceFiltersDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lifecycleStatuses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isStorefrontVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canAcceptOrders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'ISO country codes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Specific user IDs when audienceType is user',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Emails stored for audit when targeting specific users',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emails?: string[];
}

export class BroadcastPreviewDto {
  @ApiProperty({ enum: BROADCAST_AUDIENCE_TYPES })
  @IsIn(BROADCAST_AUDIENCE_TYPES)
  audienceType!: BroadcastAudienceType;

  @ApiPropertyOptional({ type: BroadcastAudienceFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BroadcastAudienceFiltersDto)
  filters?: BroadcastAudienceFiltersDto;

  @ApiPropertyOptional({
    description: 'Used to estimate 7-day dedupe skips',
  })
  @IsOptional()
  @IsString()
  messageHash?: string;

  @ApiPropertyOptional({ enum: BROADCAST_TEMPLATE_KEYS })
  @IsOptional()
  @IsIn(BROADCAST_TEMPLATE_KEYS)
  templateKey?: BroadcastTemplateKey;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}

export class CreateBroadcastDto {
  @ApiProperty({ enum: BROADCAST_AUDIENCE_TYPES })
  @IsIn(BROADCAST_AUDIENCE_TYPES)
  audienceType!: BroadcastAudienceType;

  @ApiPropertyOptional({ type: BroadcastAudienceFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BroadcastAudienceFiltersDto)
  filters?: BroadcastAudienceFiltersDto;

  @ApiProperty({ enum: BROADCAST_TEMPLATE_KEYS })
  @IsIn(BROADCAST_TEMPLATE_KEYS)
  templateKey!: BroadcastTemplateKey;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ enum: ['en', 'fr'] })
  @IsOptional()
  @IsIn(['en', 'fr'])
  sourceLanguage?: 'en' | 'fr';
}

export class BroadcastListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class BroadcastCampaignIdParamDto {
  @ApiProperty()
  @IsUUID()
  id!: string;
}
