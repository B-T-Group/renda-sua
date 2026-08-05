import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSaleItemDto {
  @ApiProperty({
    description: 'Reason shown to the business in messages and email',
    example: 'Photos do not meet quality guidelines.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  rejectionReason!: string;
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
