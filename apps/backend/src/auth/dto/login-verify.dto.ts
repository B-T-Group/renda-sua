import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginVerifyDto {
  @ApiProperty({
    description: 'Email address for OTP login',
    required: false,
    example: 'user@example.com',
  })
  @IsOptional()
  @ValidateIf((o) => !o.phone_number && !o.flowId)
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiProperty({
    description: 'Phone number for OTP login (E.164 format)',
    required: false,
    example: '+237670000000',
  })
  @IsOptional()
  @ValidateIf((o) => !o.email && !o.flowId)
  @IsString()
  @MinLength(10, { message: 'Phone number must be at least 10 characters' })
  phone_number?: string;

  @ApiPropertyOptional({
    description:
      'Opaque flow id from start-otp (auth flow v2). When set, email/phone are omitted.',
  })
  @IsOptional()
  @IsString()
  flowId?: string;

  @ApiProperty({
    description: '4-digit OTP code',
    example: '1234',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
  })
  @IsString()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'OTP must contain only digits' })
  otp!: string;

  @ApiPropertyOptional({
    enum: ['email', 'sms'],
    description:
      'Channel where the OTP was delivered. When set, Auth0 is verified against that contact on the user.',
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
