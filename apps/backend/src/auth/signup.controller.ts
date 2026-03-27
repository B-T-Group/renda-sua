import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './user.decorator';
import { Public } from './public.decorator';
import { SignupCreatedUser, SignupService } from './signup.service';

@ApiTags('auth')
@Controller('auth')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Public()
  @Get('email-availability')
  @ApiOperation({ summary: 'Check if email is already taken' })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Email availability status' })
  async emailAvailability(@Query('email') email: string): Promise<{ taken: boolean }> {
    if (!email || !email.trim()) {
      return { taken: false };
    }
    const taken = await this.signupService.isEmailTaken(email);
    return { taken };
  }

  @Public()
  @Post('signup/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create pending signup user' })
  @ApiResponse({ status: 201, description: 'User created' })
  async signupStart(@Body() body: any): Promise<{ success: boolean; user: SignupCreatedUser }> {
    const result = await this.signupService.startSignup(body);
    return {
      success: true,
      user: result.user,
    };
  }

  @Public()
  @Post('signup/verify-otp')
  @ApiOperation({ summary: 'Verify email OTP via Auth0' })
  async verifyOtp(@Body() body: { email: string; otp: string; userId: string }) {
    const tokenData = await this.signupService.verifyOtp(body.email, body.otp);
    return {
      success: true,
      verified: true,
      userId: body.userId,
      ...tokenData,
    };
  }

  @Post('signup/complete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete signup by linking Auth0 identifier' })
  async signupComplete(
    @Body() body: { userId: string },
    @CurrentUser() auth0User: any
  ) {
    const result = await this.signupService.completeSignup(body.userId, auth0User);
    return { success: true, user: result.user };
  }
}
