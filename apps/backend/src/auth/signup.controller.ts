import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RENDASUA_PLATFORM_HEADER } from '../agents/agent-location-claim.util';
import { resolveMetaActionSource } from '../meta-conversions/resolve-meta-action-source.util';
import { CurrentUser } from './user.decorator';
import { Public } from './public.decorator';
import type { ClientPlatform } from './platform.decorator';
import { Platform } from './platform.decorator';
import { SignupAttemptStartResult, SignupService } from './signup.service';
import { SignupStartDto } from './dto/signup-start.dto';
import { SignupResendOtpDto, SignupVerifyOtpDto } from './dto/signup-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Public()
  @Get('email-availability')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
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
  @Throttle({ short: { limit: 30, ttl: 60000 } })
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
      'Validate signup details, create a short-lived signup attempt, and send OTP',
  })
  @ApiBody({ type: SignupStartDto })
  @ApiResponse({ status: 201, description: 'Signup attempt created and OTP sent' })
  @ApiResponse({ status: 400, description: 'Invalid referral code or payload' })
  @ApiResponse({ status: 409, description: 'Email or phone already taken' })
  async signupStart(
    @Body() body: SignupStartDto,
    @Req() req: { ip?: string; headers?: Record<string, unknown> },
    @Headers(RENDASUA_PLATFORM_HEADER) platform?: string
  ): Promise<{ success: boolean } & SignupAttemptStartResult> {
    const ua = req.headers?.['user-agent'];
    const result = await this.signupService.startSignup({
      ...body,
      actionSource: resolveMetaActionSource(platform),
      clientIpAddress: req.ip,
      clientUserAgent: typeof ua === 'string' ? ua : undefined,
    });
    return {
      success: true,
      ...result,
    };
  }

  @Public()
  @Post('signup/resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Resend OTP for an existing signup attempt' })
  @ApiBody({ type: SignupResendOtpDto })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  @ApiResponse({ status: 429, description: 'Resend cooldown active' })
  async signupResendOtp(
    @Body() body: SignupResendOtpDto
  ): Promise<{ success: boolean } & SignupAttemptStartResult> {
    const result = await this.signupService.resendSignupOtp(body.attemptId);
    return { success: true, ...result };
  }

  @Public()
  @Post('signup/update-contact')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Deprecated — restart signup with corrected contact details',
    deprecated: true,
  })
  @ApiResponse({ status: 410, description: 'Endpoint retired' })
  async signupUpdateContact(): Promise<never> {
    return this.signupService.updateContact();
  }

  @Public()
  @Post('signup/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 15, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Verify signup OTP, create the durable account. Web clients receive HttpOnly session cookie; mobile clients receive tokens in JSON.',
  })
  @ApiBody({ type: SignupVerifyOtpDto })
  @ApiResponse({ status: 200, description: 'Account created and authenticated' })
  async verifyOtp(
    @Body() body: SignupVerifyOtpDto,
    @Platform() platform: ClientPlatform,
    @Req() req: { ip?: string; headers?: Record<string, unknown> },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.signupService.verifySignupOtp(
      body,
      platform,
      req.ip,
      typeof req.headers?.['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined
    );

    if (platform === 'web' && result.sessionId) {
      res.cookie('rs_session', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
      });
    }

    return result.response;
  }

  @Post('signup/complete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Deprecated — completion happens in verify-otp',
    deprecated: true,
  })
  @ApiResponse({ status: 410, description: 'Endpoint retired' })
  async signupComplete(
    @Body() _body: { userId: string },
    @CurrentUser() _auth0User: unknown
  ): Promise<never> {
    return this.signupService.completeSignup();
  }
}
