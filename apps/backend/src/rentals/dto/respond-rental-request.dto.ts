import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RentalPricingSnapshotDto } from './rental-pricing-snapshot.dto';

export enum RespondRentalRequestStatusDto {
  available = 'available',
  unavailable = 'unavailable',
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessResponseNote?: string;
}
