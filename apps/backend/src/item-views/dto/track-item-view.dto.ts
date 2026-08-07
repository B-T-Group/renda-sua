import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class TrackItemViewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;

  @ApiPropertyOptional({
    description: 'Shared with Pixel eventID for Meta CAPI deduplication',
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentName?: string;

  @ApiPropertyOptional({
    description: 'Meta _fbc cookie (Click ID); do not hash',
  })
  @IsOptional()
  @IsString()
  fbc?: string;

  @ApiPropertyOptional({
    description: 'Meta _fbp cookie (Browser ID); do not hash',
  })
  @IsOptional()
  @IsString()
  fbp?: string;

  @ApiPropertyOptional({
    description: 'Page URL where the view occurred (event_source_url)',
  })
  @IsOptional()
  @IsString()
  eventSourceUrl?: string;
}
