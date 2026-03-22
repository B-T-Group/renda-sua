import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateBusinessRentalListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  rental_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  business_location_id!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pickup_instructions?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dropoff_instructions?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  base_price_per_day!: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  min_rental_days?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_rental_days?: number | null;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  units_available?: number;
}
