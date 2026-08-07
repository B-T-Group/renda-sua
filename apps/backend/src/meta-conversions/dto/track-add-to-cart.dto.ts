import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class TrackAddToCartDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  inventoryItemId!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentCategory?: string;

  @ApiPropertyOptional({
    description: 'Shared with Pixel eventID for deduplication',
  })
  @IsOptional()
  @IsString()
  eventId?: string;

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
    description: 'Page URL where add-to-cart occurred (event_source_url)',
  })
  @IsOptional()
  @IsString()
  eventSourceUrl?: string;
}
