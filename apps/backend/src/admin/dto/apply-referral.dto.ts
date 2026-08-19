import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ApplyReferralDto {
  @ApiProperty({
    description: '6-character alphanumeric referral code',
    example: 'AB12CD',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9]{6}$/, {
    message: 'Referral code must be 6 alphanumeric characters',
  })
  code!: string;
}
