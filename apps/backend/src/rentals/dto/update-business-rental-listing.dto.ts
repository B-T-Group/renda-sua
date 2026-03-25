import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class UpdateRentalWeeklyAvailabilityDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty()
  @IsBoolean()
  is_available!: boolean;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.is_available === true)
  @IsString()
  start_time?: string | null;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.is_available === true)
  @IsString()
  end_time?: string | null;
}

export class UpdateBusinessRentalListingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pickup_instructions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dropoff_instructions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_price_per_hour?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_price_per_day?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  min_rental_hours?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.max_rental_hours != null)
  @IsInt()
  @Min(1)
  max_rental_hours?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  units_available?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ required: false, type: [UpdateRentalWeeklyAvailabilityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRentalWeeklyAvailabilityDto)
  weekly_availability?: UpdateRentalWeeklyAvailabilityDto[];
}
