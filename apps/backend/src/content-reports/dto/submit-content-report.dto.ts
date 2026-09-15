import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const CONTENT_REPORT_SUBJECT_TYPES = [
  'reel',
  'reel_comment',
  'sale_item',
  'rental_listing',
] as const;

export const CONTENT_REPORT_REASONS = [
  'spam',
  'misleading',
  'inappropriate',
  'harassment',
  'intellectual_property',
  'off_platform_contact',
  'other',
] as const;

export type ContentReportSubjectType =
  (typeof CONTENT_REPORT_SUBJECT_TYPES)[number];

export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];

export class SubmitContentReportDto {
  @ApiProperty({ enum: CONTENT_REPORT_SUBJECT_TYPES })
  @IsEnum(CONTENT_REPORT_SUBJECT_TYPES)
  subjectType!: ContentReportSubjectType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ enum: CONTENT_REPORT_REASONS })
  @IsEnum(CONTENT_REPORT_REASONS)
  reason!: ContentReportReason;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
