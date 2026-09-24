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
import { AuthAvailabilityLimiterService } from './auth-availability-limiter.service';
import { SignupAttemptStartResult, SignupService } from './signup.service';
import { SignupStartDto } from './dto/signup-start.dto';
import { SignupResendOtpDto, SignupVerifyOtpDto } from './dto/signup-otp.dto';
import { SignupFinishDto } from './dto/signup-finish.dto';
import { sessionCookieOptions } from './session-cookie';

@ApiTags('auth')
@Controller('auth')
export class SignupController {
  constructor(
    private readonly signupService: SignupService,
    private readonly availabilityLimiter: AuthAvailabilityLimiterService
  ) {}

  @Public()
  @Get('email-availability')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Check if email is already taken',
    deprecated: true,
    description:
      'Deprecated: prefer in-flow auth (flow_version 2). Subject to per-IP daily caps.',
  })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Email availability status' })
  @ApiResponse({ status: 429, description: 'Daily per-IP availability cap exceeded' })
  async emailAvailability(
    @Query('email') email: string,
    @Req() req: { ip?: string }
  ): Promise<{ taken: boolean }> {
    await this.availabilityLimiter.assertAndRecordCheck(req.ip);
    if (!email || !email.trim()) {
      return { taken: false };
    }
    const taken = await this.signupService.isEmailTaken(email);
    return { taken };
  }

  @Public()
  @Get('phone-availability')
  @Throttle({ short: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Check if phone number is already taken',
    deprecated: true,
    description:
      'Deprecated: prefer in-flow auth (flow_version 2). Subject to per-IP daily caps.',
  })
  @ApiQuery({ name: 'phone_number', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Phone availability status' })
  @ApiResponse({ status: 429, description: 'Daily per-IP availability cap exceeded' })
  async phoneAvailability(
    @Query('phone_number') phoneNumber: string,
    @Req() req: { ip?: string }
  ): Promise<{ taken: boolean }> {
    await this.availabilityLimiter.assertAndRecordCheck(req.ip);
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
    @Body() body: SignupResendOtpDto,
    @Req() req: { ip?: string }
  ): Promise<{ success: boolean } & SignupAttemptStartResult> {
    const result = await this.signupService.resendSignupOtp(
      body.attemptId,
      body.channel,
      req.ip
    );
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
  @Post('signup/finish')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Auth flow v2: finish account after OTP verify (name, terms, optional persona/country)',
  })
  @ApiBody({ type: SignupFinishDto })
  @ApiResponse({ status: 200, description: 'Account provisioned and session issued' })
  @ApiResponse({ status: 409, description: 'Attempt not ready or already completed' })
  @ApiResponse({ status: 410, description: 'Attempt expired' })
  async signupFinish(
    @Body() body: SignupFinishDto,
    @Platform() platform: ClientPlatform,
    @Req() req: { ip?: string; headers?: Record<string, unknown> },
    @Res({ passthrough: true }) res: Response
  ) {
    const ua = req.headers?.['user-agent'];
    const result = await this.signupService.finishSignupAccount(
      {
        flowId: body.flowId,
        accept_terms: body.accept_terms,
        first_name: body.first_name,
        last_name: body.last_name,
        user_type_id: body.user_type_id,
        personas: body.personas,
        country: body.country,
        profile: body.profile ?? {},
        referral_agent_code: body.referral_agent_code,
      },
      platform,
      req.ip,
      typeof ua === 'string' ? ua : undefined
    );

    if (platform === 'web' && result.sessionId) {
      res.cookie('rs_session', result.sessionId, sessionCookieOptions(req));
    }

    return result.response;
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
      res.cookie('rs_session', result.sessionId, sessionCookieOptions(req));
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
