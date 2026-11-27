import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateProductInterestDto {
  @ApiProperty({ description: 'business_inventory.id for the listing' })
  @IsUUID()
  businessInventoryId!: string;

  @ApiPropertyOptional({ description: 'Optional note from the client' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiProperty({
    description:
      'Browsing market ISO-2 code. Required (no default). For in-app interest it must be one of the item export markets, otherwise 400 NOT_EXPORTED_TO_MARKET.',
    example: 'CM',
  })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional({
    description:
      "Where the interest was sent from. 'in_app' (default) enforces the destination check. 'public_export_catalog' is a partner inquiry from the public /exports/{cc} page: any market may send it, it goes to the business as a lead and never opens an export order.",
    enum: ['in_app', 'public_export_catalog'],
    default: 'in_app',
  })
  @IsOptional()
  @IsIn(['in_app', 'public_export_catalog'])
  source?: 'in_app' | 'public_export_catalog';
}
