import { IsEnum, IsISO8601, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { DiscountType } from './create-item-deal.dto';

export class UpdateItemDealDto {
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  discountValue?: number;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  isActive?: boolean;
}

