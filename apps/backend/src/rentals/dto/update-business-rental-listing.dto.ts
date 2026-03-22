import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

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
  base_price_per_day?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  min_rental_days?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.max_rental_days != null)
  @IsInt()
  @Min(1)
  max_rental_days?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  units_available?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
