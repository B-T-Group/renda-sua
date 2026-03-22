import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RentalPricingSnapshotDto } from './rental-pricing-snapshot.dto';

export enum RespondRentalRequestStatusDto {
  available = 'available',
  unavailable = 'unavailable',
}

/** Persisted on `rental_requests.unavailable_reason_code` when status is unavailable. */
export enum UnavailableRentalReasonCode {
  fully_booked = 'fully_booked',
  dates_not_available = 'dates_not_available',
  item_unavailable = 'item_unavailable',
  pricing_mismatch = 'pricing_mismatch',
  other = 'other',
}

export class RespondRentalRequestDto {
  @ApiProperty({ enum: RespondRentalRequestStatusDto })
  @IsEnum(RespondRentalRequestStatusDto)
  status!: RespondRentalRequestStatusDto;

  @ApiProperty({ type: RentalPricingSnapshotDto, required: false })
  @ValidateIf((o) => o.status === RespondRentalRequestStatusDto.available)
  @ValidateNested()
  @Type(() => RentalPricingSnapshotDto)
  rentalPricingSnapshot?: RentalPricingSnapshotDto;

  @ApiProperty({
    description: 'Hours until the proposed contract expires (1–168). Required when status is available.',
    required: false,
    minimum: 1,
    maximum: 168,
  })
  @ValidateIf((o) => o.status === RespondRentalRequestStatusDto.available)
  @IsInt()
  @Min(1)
  @Max(168)
  contractExpiryHours?: number;

  @ApiProperty({
    enum: UnavailableRentalReasonCode,
    required: false,
    description: 'Required when status is unavailable.',
  })
  @ValidateIf((o) => o.status === RespondRentalRequestStatusDto.unavailable)
  @IsEnum(UnavailableRentalReasonCode)
  unavailableReasonCode?: UnavailableRentalReasonCode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessResponseNote?: string;
}
