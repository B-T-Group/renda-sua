import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RENDASUA_PLATFORM_HEADER } from '../agents/agent-location-claim.util';
import { resolveMetaActionSource } from '../meta-conversions/resolve-meta-action-source.util';
import { Public } from './public.decorator';
import { SignupStartDto } from './dto/signup-start.dto';
import {
  SignupResendOtpDto,
  SignupVerifyOtpDto,
} from './dto/signup-verify-otp.dto';
import {
  SignupService,
  type SignupStartAttemptResult,
} from './signup.service';
import type { SignupCompletionResult } from './signup-attempt.types';

@ApiTags('auth')
@Controller('auth')
@Throttle({ short: { limit: 20, ttl: 60000 } })
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Public()
  @Get('email-availability')
  @ApiOperation({ summary: 'Check if email is already taken' })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Email availability status' })
  async emailAvailability(
    @Query('email') email: string
  ): Promise<{ taken: boolean }> {
    if (!email || !email.trim()) {
      return { taken: false };
    }
    const taken = await this.signupService.isEmailTaken(email);
    return { taken };
  }

  @Public()
  @Get('phone-availability')
  @ApiOperation({ summary: 'Check if phone number is already taken' })
  @ApiQuery({ name: 'phone_number', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Phone availability status' })
  async phoneAvailability(
    @Query('phone_number') phoneNumber: string
  ): Promise<{ taken: boolean }> {
    if (!phoneNumber || !phoneNumber.trim()) {
      return { taken: false };
    }
    const taken = await this.signupService.isPhoneTaken(phoneNumber);
    return { taken };
  }

  @Public()
  @Post('signup/start')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 8, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Start signup: validate details, create an expiring attempt, and send OTP (no user row yet)',
  })
  @ApiBody({ type: SignupStartDto })
  @ApiResponse({ status: 201, description: 'Signup attempt created and OTP sent' })
  @ApiResponse({ status: 400, description: 'Invalid referral code or payload' })
  @ApiResponse({ status: 409, description: 'Email or phone already taken' })
  async signupStart(
    @Body() body: SignupStartDto,
    @Request() req: { ip?: string; headers?: Record<string, unknown> },
    @Headers(RENDASUA_PLATFORM_HEADER) platform?: string
  ): Promise<{ success: boolean } & SignupStartAttemptResult> {
    const ua = req.headers?.['user-agent'];
    const result = await this.signupService.startSignup({
      ...body,
      actionSource: resolveMetaActionSource(platform),
      clientIpAddress: req.ip,
      clientUserAgent: typeof ua === 'string' ? ua : undefined,
    });
    return { success: true, ...result };
  }

  @Public()
  @Post('signup/resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Resend OTP for an active signup attempt' })
  @ApiBody({ type: SignupResendOtpDto })
  async signupResendOtp(
    @Body() body: SignupResendOtpDto
  ): Promise<{ success: boolean } & SignupStartAttemptResult> {
    const result = await this.signupService.resendSignupOtp(body.attemptId);
    return { success: true, ...result };
  }

  @Public()
  @Post('signup/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Verify signup OTP, create the user account, and return Auth0 tokens',
  })
  @ApiBody({ type: SignupVerifyOtpDto })
  async verifyOtp(
    @Body() body: SignupVerifyOtpDto
  ): Promise<{ success: boolean; verified: true } & SignupCompletionResult> {
    const result = await this.signupService.verifySignupOtp(body);
    return {
      success: true,
      verified: true,
      ...result,
    };
  }

  @Public()
  @Post('signup/update-contact')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Retired — restart signup to change contact before OTP',
    deprecated: true,
  })
  async signupUpdateContact(): Promise<never> {
    return this.signupService.updateContact({});
  }

  @Post('signup/complete')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Retired — completion is part of signup/verify-otp',
    deprecated: true,
  })
  async signupComplete(): Promise<never> {
    return this.signupService.completeSignup('', null);
  }
}
