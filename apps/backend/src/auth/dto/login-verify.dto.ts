import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength, ValidateIf } from 'class-validator';

export class LoginVerifyDto {
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
}
