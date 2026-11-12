import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RentalRequestWindowDto } from './rental-request-window.dto';

export class UpdateRentalRequestDto {
  @ApiProperty({ minimum: 1, description: 'edit_version the renter last loaded' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ required: false, description: 'Omit on a notes-only edit; the saved windows are kept' })
  @IsOptional()
  @IsISO8601()
  requestedStartAt?: string;

  @ApiProperty({ required: false, description: 'Omit on a notes-only edit; the saved windows are kept' })
  @IsOptional()
  @IsISO8601()
  requestedEndAt?: string;

  @ApiProperty({ required: false, type: [RentalRequestWindowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RentalRequestWindowDto)
  windows?: RentalRequestWindowDto[];

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitsRequested?: number;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientRequestNote?: string;
}
