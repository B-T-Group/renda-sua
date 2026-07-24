import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class InitiateAccountRechargeDto {
  @ApiProperty({
    description: 'ISO country calling code without +, e.g. "237" for Cameroon, "241" for Gabon',
    example: '237',
  })
  @IsString()
  countryCode!: string;

  @ApiProperty({
    description: 'Local phone number (without country code)',
    example: '670000000',
  })
  @IsString()
  phoneNumber!: string;

  @ApiProperty({
    description: 'Amount to collect in XAF (min 150)',
    example: 5000,
  })
  @IsNumber()
  @Min(150)
  amount!: number;
}
