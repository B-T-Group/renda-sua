import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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

  @ApiProperty({
    required: false,
    description: 'Use the latest active start PIN shared in booking chat',
  })
  @IsOptional()
  @IsBoolean()
  useLatestSharedPin?: boolean;

  @ApiProperty({
    required: false,
    description: 'Specific shared PIN message id from booking chat',
  })
  @IsOptional()
  @IsUUID()
  pinMessageId?: string;
}
