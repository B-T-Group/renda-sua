import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SignupVerifyOtpDto {
  @ApiProperty({ description: 'Opaque signup attempt id from /auth/signup/start' })
  @IsString()
  @MinLength(1)
  attemptId!: string;

  @ApiProperty({ description: 'OTP code sent to the attempt contact' })
  @IsString()
  @MinLength(4)
  otp!: string;
}

export class SignupResendOtpDto {
  @ApiProperty({ description: 'Opaque signup attempt id from /auth/signup/start' })
  @IsString()
  @MinLength(1)
  attemptId!: string;
}
