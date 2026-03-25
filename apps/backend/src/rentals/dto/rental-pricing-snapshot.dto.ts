import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Hourly line on rental_pricing_snapshot (version 3+). */
export type RentalPricingLineHourly = {
  kind: 'hourly';
  startAt: string;
  endAt: string;
  billableHours: number;
  ratePerHour: number;
  subtotal: number;
};

/** All-day flat line on rental_pricing_snapshot (version 3+). */
export type RentalPricingLineAllDay = {
  kind: 'all_day';
  calendarDate: string;
  ratePerDay: number;
  subtotal: number;
};

export type RentalPricingLine = RentalPricingLineHourly | RentalPricingLineAllDay;

export class RentalPricingSnapshotDto {
  @ApiProperty({ example: 3 })
  @IsNumber()
  version!: number;

  @ApiProperty({ example: 'XAF' })
  @IsString()
  currency!: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  total!: number;

  @ApiProperty({ required: false, example: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerHour?: number;

  @ApiProperty({ required: false, example: 6.5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  hours?: number;

  @ApiProperty({
    required: false,
    description: 'Per-window breakdown (version 3+)',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  lines?: RentalPricingLine[];

  @ApiProperty({ example: '2025-03-22T12:00:00.000Z' })
  @IsString()
  computedAt!: string;
}

export function isValidRentalPricingSnapshot(
  value: unknown
): value is RentalPricingSnapshotDto {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (
    typeof o.version !== 'number' ||
    typeof o.currency !== 'string' ||
    typeof o.total !== 'number' ||
    o.total < 0 ||
    typeof o.computedAt !== 'string'
  ) {
    return false;
  }
  if (o.version === 3 && o.lines != null && !Array.isArray(o.lines)) {
    return false;
  }
  return true;
}
