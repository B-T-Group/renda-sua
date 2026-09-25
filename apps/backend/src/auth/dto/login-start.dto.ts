import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginStartDto {
  @ApiProperty({
    description: 'Email address for OTP login',
    required: false,
    example: 'user@example.com',
  })
  @IsOptional()
  @ValidateIf((o) => !o.phone_number)
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiProperty({
    description: 'Phone number for OTP login (E.164 format)',
    required: false,
    example: '+237670000000',
  })
  @IsOptional()
  @ValidateIf((o) => !o.email)
  @IsString()
  @MinLength(10, { message: 'Phone number must be at least 10 characters' })
  phone_number?: string;

  @ApiPropertyOptional({
    enum: ['email', 'sms'],
    description:
      'Optional OTP delivery channel. When omitted, OTP is sent to the provided identifier.',
  })
  @IsOptional()
  @IsIn(['email', 'sms'])
  channel?: 'email' | 'sms';

  @ApiPropertyOptional({
    description:
      'Auth flow version. When set to 2, responses avoid account-enumeration oracles.',
    enum: [2],
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([2])
  flow_version?: number;
}
