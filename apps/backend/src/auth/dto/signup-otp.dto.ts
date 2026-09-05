import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SignupVerifyOtpDto {
  @ApiProperty({ description: 'Opaque signup attempt id from /auth/signup/start' })
  @IsUUID()
  attemptId!: string;

  @ApiProperty({ description: 'OTP code received by email or SMS' })
  @IsString()
  @MinLength(4)
  otp!: string;
}

export class SignupResendOtpDto {
  @ApiProperty({ description: 'Opaque signup attempt id from /auth/signup/start' })
  @IsUUID()
  attemptId!: string;
}

export class SignupStartChannelDto {
  @ApiPropertyOptional({
    enum: ['email', 'sms'],
    description: 'Optional OTP channel preference; server may override when invalid',
  })
  @IsOptional()
  @IsString()
  verification_channel?: 'email' | 'sms';
}
