import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyRentalStartPinDto {
  @ApiProperty({ required: false, description: '4-digit start PIN from client' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  pin?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  overwriteCode?: string;
}
