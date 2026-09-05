import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class DeliveryEstimateQueryDto {
  @IsString()
  marketId!: string;

  @IsString()
  @IsOptional()
  areaId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsUUID()
  @IsOptional()
  sellerId?: string;

  @IsUUID()
  @IsOptional()
  skuId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  qty?: number;
}
