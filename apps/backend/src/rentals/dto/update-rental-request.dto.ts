import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RentalRequestWindowDto } from './rental-request-window.dto';

export class ConfirmedRentalTotalDto {
  @ApiProperty({ description: 'New quoted total the renter confirmed' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: 'XAF' })
  @IsString()
  @MaxLength(8)
  currency!: string;
}

export class UpdateRentalRequestDto {
  @ApiProperty({ minimum: 1, description: 'edit_version the renter last loaded' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ required: false })
  @ValidateIf((row) => !row.windows?.length)
  @IsISO8601()
  requestedStartAt?: string;

  @ApiProperty({ required: false })
  @ValidateIf((row) => !row.windows?.length)
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

  @ApiProperty({ required: false, type: ConfirmedRentalTotalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmedRentalTotalDto)
  confirmedTotal?: ConfirmedRentalTotalDto;
}
