import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './public.decorator';
import { LoginService } from './login.service';

@ApiTags('auth')
@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Public()
  @Post('login/start-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a login OTP to an existing user (email or phone)',
  })
  @ApiResponse({ status: 200, description: 'OTP started successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or ambiguous identifier' })
  @ApiResponse({ status: 404, description: 'User not found for email or phone' })
  async startOtp(
    @Body() body: { email?: string; phone_number?: string }
  ): Promise<{ success: boolean }> {
    await this.loginService.startLoginOtp(body);
    return { success: true };
  }

  @Public()
  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify login OTP and return Auth0 tokens (email or phone)',
  })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 404, description: 'User not found for email or phone' })
  @ApiResponse({ status: 409, description: 'Auth0 identity mismatch for email' })
  async verifyOtp(
    @Body() body: { email?: string; phone_number?: string; otp: string }
  ) {
    const tokenData = await this.loginService.verifyLoginOtp(body);
    return { success: true, verified: true, ...tokenData };
  }
}

