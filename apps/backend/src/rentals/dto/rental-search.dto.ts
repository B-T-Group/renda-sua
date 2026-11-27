import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class RentalSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsIn(['relevance', 'newest', 'cheapest', 'expensive', 'recommended'])
  sort?: string;

  @IsOptional()
  @IsIn(['business_operated', 'take_home'])
  operation_mode?: string;

  @IsOptional()
  @Matches(DATE)
  start_date?: string;

  @IsOptional()
  @Matches(DATE)
  end_date?: string;

  /** Listing wall-clock HH:mm on start_date. Omitted means the start of the day. */
  @IsOptional()
  @Matches(CLOCK)
  start_time?: string;

  /** Listing wall-clock HH:mm on the last day (end_date minus one day). 24:00 is the end of that day. */
  @IsOptional()
  @Matches(CLOCK)
  end_time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  min_price?: number;

  @IsOptional()
  @Type(() => Number)
  max_price?: number;
}

export class RentalSuggestQueryDto {
  @IsString()
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;
}

export class RentalTopCategoriesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  limit?: number;
}

export class CreateRentalAvailabilitySubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @Matches(DATE)
  start_date!: string;

  @Matches(DATE)
  end_date!: string;
}
