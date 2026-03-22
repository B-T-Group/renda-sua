import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID } from 'class-validator';

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
}
