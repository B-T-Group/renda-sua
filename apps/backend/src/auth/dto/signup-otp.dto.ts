import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({
    enum: ['email', 'sms'],
    description:
      'Optional channel to switch to. When different from the attempt channel and the contact exists, cooldown is skipped.',
  })
  @IsOptional()
  @IsIn(['email', 'sms'])
  channel?: 'email' | 'sms';
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
