import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProductInterestDto {
  @ApiProperty({ description: 'business_inventory.id for the listing' })
  @IsUUID()
  businessInventoryId!: string;

  @ApiPropertyOptional({ description: 'Optional note from the client' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
