import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { REJECTION_CATEGORIES } from '../../item-appeals/item-recovery.constants';
import type { RejectionCategory } from '../../item-appeals/item-recovery.constants';

export class RejectSaleItemDto {
  @ApiProperty({
    description: 'Reason shown to the business in messages and email',
    example: 'Photos do not meet quality guidelines.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  rejectionReason!: string;

  @ApiProperty({
    enum: REJECTION_CATEGORIES,
    description: 'A4: required. Drives the business recovery actions (B8).',
  })
  @IsIn(REJECTION_CATEGORIES as unknown as string[])
  rejectionCategory!: RejectionCategory;
}

export class MessageBusinessAboutItemDto {
  @ApiProperty({
    description: 'Message body sent to the business owner as a thread',
    example: 'Please update the product photos and resubmit.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body!: string;

  @ApiPropertyOptional({
    description: 'Optional thread subject (defaults to item name)',
    example: 'Question about your product listing',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;
}
