import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class CreateProductInterestDto {
  @ApiProperty({ description: 'business_inventory.id for the listing' })
  @IsUUID()
  businessInventoryId!: string;

  @ApiPropertyOptional({ description: 'Optional note from the client' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Destination country ISO-2 code (the shopper market). Used to resolve the export order flag; defaults to CM.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}
