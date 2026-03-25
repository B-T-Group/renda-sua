import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

export class RentalWeeklyAvailabilityDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty()
  @IsBoolean()
  is_available!: boolean;

  @ApiProperty({ required: false, description: 'HH:mm:ss when available' })
  @ValidateIf((o) => o.is_available === true)
  @IsString()
  start_time?: string | null;

  @ApiProperty({ required: false, description: 'HH:mm:ss when available' })
  @ValidateIf((o) => o.is_available === true)
  @IsString()
  end_time?: string | null;
}

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
  base_price_per_hour!: number;

  @ApiProperty({ description: 'Flat price for one full-day (all-day) rental window' })
  @IsNumber()
  @Min(0)
  base_price_per_day!: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  min_rental_hours?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_rental_hours?: number | null;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  units_available?: number;

  @ApiProperty({
    required: false,
    type: [RentalWeeklyAvailabilityDto],
    description: '7 rows, weekday 0..6, one contiguous availability window per day',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RentalWeeklyAvailabilityDto)
  weekly_availability?: RentalWeeklyAvailabilityDto[];
}
