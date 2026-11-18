import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
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

  @ApiProperty({
    required: false,
    description:
      'Replaces the server quote. Accepted only while modify-request and dashboard requests are both on. Must be positive, in the item currency.',
    minimum: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  totalOverride?: number;

  @ApiProperty({ type: RentalPricingSnapshotDto, required: false })
  @ValidateIf((o) => o.status === RespondRentalRequestStatusDto.available)
  @ValidateNested()
  @Type(() => RentalPricingSnapshotDto)
  rentalPricingSnapshot?: RentalPricingSnapshotDto;

  @ApiProperty({
    description:
      'Whole hours until the renter must confirm (1–48, and not past the rental start). Required when status is available. Under one hour, the server ends the contract at the start.',
    required: false,
    minimum: 1,
    maximum: 48,
  })
  @ValidateIf((o) => o.status === RespondRentalRequestStatusDto.available)
  @IsInt()
  @Min(1)
  @Max(48)
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

  @ApiProperty({
    required: false,
    description:
      'edit_version the business loaded. Required while modify-request is enabled. A mismatch is rejected.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
