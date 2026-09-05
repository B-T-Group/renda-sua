import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';
import { LoginService } from './login.service';
import { LoginStartDto } from './dto/login-start.dto';
import { LoginVerifyDto } from './dto/login-verify.dto';
import type { ClientPlatform } from './platform.decorator';
import { Platform } from './platform.decorator';

@ApiTags('auth')
@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Public()
  @Post('login/start-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Send a 4-digit login OTP to an existing user (email or phone)',
  })
  @ApiBody({ type: LoginStartDto })
  @ApiResponse({ status: 200, description: 'OTP started successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid identifier or Auth0 rejected OTP start',
  })
  @ApiResponse({ status: 404, description: 'User not found for email or phone' })
  @ApiResponse({ status: 429, description: 'Too many OTP start attempts' })
  async startOtp(@Body() body: LoginStartDto): Promise<{ success: boolean }> {
    await this.loginService.startLoginOtp(body);
    return { success: true };
  }

  @Public()
  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Verify 4-digit login OTP. Web clients receive HttpOnly session cookie; mobile clients receive tokens in JSON.',
  })
  @ApiBody({ type: LoginVerifyDto })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or OTP' })
  @ApiResponse({ status: 404, description: 'User not found for email or phone' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts' })
  async verifyOtp(
    @Body() body: LoginVerifyDto,
    @Platform() platform: ClientPlatform,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.loginService.verifyLoginOtp(
      body,
      platform,
      req.ip,
      req.headers['user-agent']
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

  @Public()
  @Post('login/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Silent token refresh for web clients using HttpOnly session cookie',
  })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired session' })
  @ApiResponse({ status: 403, description: 'CSRF check failed' })
  async refreshSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Header('x-requested-with') csrfHeader?: string
  ) {
    // CSRF protection: require X-Requested-With header
    if (csrfHeader !== 'XMLHttpRequest') {
      throw new HttpException(
        { success: false, error: 'CSRF validation failed' },
        HttpStatus.FORBIDDEN
      );
    }

    const sessionId = req.cookies['rs_session'];
    if (!sessionId) {
      throw new HttpException(
        { success: false, error: 'Session cookie not found' },
        HttpStatus.UNAUTHORIZED
      );
    }

    const result = await this.loginService.refreshSession(
      sessionId,
      req.ip,
      req.headers['user-agent']
    );

    if (result.newSessionId) {
      res.cookie('rs_session', result.newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
      });
    }

    return result.response;
  }

  @Public()
  @Post('login/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout and clear session cookie for web clients',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 403, description: 'CSRF check failed' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Header('x-requested-with') csrfHeader?: string
  ) {
    // CSRF protection: require X-Requested-With header
    if (csrfHeader !== 'XMLHttpRequest') {
      throw new HttpException(
        { success: false, error: 'CSRF validation failed' },
        HttpStatus.FORBIDDEN
      );
    }

    const sessionId = req.cookies['rs_session'];
    if (sessionId) {
      await this.loginService.destroySession(sessionId);
    }

    res.clearCookie('rs_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }
}
