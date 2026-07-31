import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateMobilePaymentPhoneDto {
  @ApiProperty({ example: '237', description: 'Country calling code without +' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2,3}$/)
  countryCode!: string;

  @ApiProperty({ example: '677123456', description: 'National number without country code' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}

export class UpdateMobilePaymentPhoneDto {
  @ApiProperty({ example: '237' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2,3}$/)
  countryCode!: string;

  @ApiProperty({ example: '677123456' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}

export class AttachAgentMobilePaymentPhoneDto {
  @ApiPropertyOptional({ description: 'Registry phone id to attach to agent profile' })
  @IsString()
  @IsNotEmpty()
  mobilePaymentPhoneId!: string;
}
