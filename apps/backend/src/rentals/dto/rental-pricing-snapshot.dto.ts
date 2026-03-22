import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RentalPricingSnapshotDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  version!: number;

  @ApiProperty({ example: 'XAF' })
  @IsString()
  currency!: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  total!: number;

  @ApiProperty({ required: false, example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerDay?: number;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  days?: number;

  @ApiProperty({ example: '2025-03-22T12:00:00.000Z' })
  @IsString()
  computedAt!: string;
}

export function isValidRentalPricingSnapshot(
  value: unknown
): value is RentalPricingSnapshotDto {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.version === 'number' &&
    typeof o.currency === 'string' &&
    typeof o.total === 'number' &&
    o.total >= 0 &&
    typeof o.computedAt === 'string'
  );
}
