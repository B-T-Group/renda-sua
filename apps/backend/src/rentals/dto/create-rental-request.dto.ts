import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RentalRequestWindowDto } from './rental-request-window.dto';

export class CreateRentalRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rentalLocationListingId!: string;

  @ApiProperty({
    description:
      'Rental period start (ISO 8601). Required when `windows` is omitted; otherwise should equal earliest window start.',
  })
  @ValidateIf((o) => !o.windows?.length)
  @IsISO8601()
  requestedStartAt?: string;

  @ApiProperty({
    description:
      'Rental period end (ISO 8601). Required when `windows` is omitted; otherwise should equal latest window end.',
  })
  @ValidateIf((o) => !o.windows?.length)
  @IsISO8601()
  requestedEndAt?: string;

  @ApiProperty({
    required: false,
    type: [RentalRequestWindowDto],
    description:
      'One or more disjoint or contiguous time windows; total billed hours are summed.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RentalRequestWindowDto)
  windows?: RentalRequestWindowDto[];

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
