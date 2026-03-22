import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRentalRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rentalLocationListingId!: string;

  @ApiProperty({ description: 'Rental period start (ISO 8601)' })
  @IsISO8601()
  requestedStartAt!: string;

  @ApiProperty({ description: 'Rental period end (ISO 8601)' })
  @IsISO8601()
  requestedEndAt!: string;

  @ApiProperty({
    required: false,
    description: 'Optional note for the business (max 2000 characters)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientRequestNote?: string;
}
