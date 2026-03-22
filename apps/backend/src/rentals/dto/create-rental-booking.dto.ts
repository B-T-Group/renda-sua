import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateRentalBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rentalRequestId!: string;
}
