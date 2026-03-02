import { IsEnum, IsISO8601, IsNumber, IsPositive } from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class CreateItemDealDto {
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsNumber()
  @IsPositive()
  discountValue!: number;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;
}

