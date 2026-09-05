import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

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
}
