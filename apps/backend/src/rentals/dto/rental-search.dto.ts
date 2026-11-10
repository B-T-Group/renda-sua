import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  @IsIn(['relevance', 'newest', 'cheapest', 'expensive'])
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
