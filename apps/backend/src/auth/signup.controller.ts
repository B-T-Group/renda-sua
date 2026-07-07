import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './user.decorator';
import { Public } from './public.decorator';
import { SignupCreatedUser, SignupService } from './signup.service';
import { SignupStartDto } from './dto/signup-start.dto';

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
  @ApiOperation({ summary: 'Create pending signup user' })
  @ApiBody({ type: SignupStartDto })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Invalid referral code' })
  async signupStart(
    @Body() body: SignupStartDto
  ): Promise<{ success: boolean; user: SignupCreatedUser }> {
    const result = await this.signupService.startSignup(body);
    return {
      success: true,
      user: result.user,
    };
  }

  @Public()
  @Post('signup/update-contact')
  @ApiOperation({
    summary: 'Update email/phone of an unverified pending signup user',
  })
  @ApiResponse({ status: 201, description: 'Contact updated' })
  @ApiResponse({ status: 404, description: 'Signup user not found' })
  @ApiResponse({
    status: 409,
    description: 'Account already verified or contact already taken',
  })
  async signupUpdateContact(
    @Body()
    body: {
      user_id: string;
      first_name?: string;
      last_name?: string;
      email?: string | null;
      phone_number?: string | null;
    }
  ): Promise<{ success: boolean; user: SignupCreatedUser }> {
    const result = await this.signupService.updateContact(body);
    return {
      success: true,
      user: result.user,
    };
  }

  @Public()
  @Post('signup/verify-otp')
  @ApiOperation({ summary: 'Verify signup OTP via Auth0 (email or phone)' })
  async verifyOtp(
    @Body()
    body: {
      email?: string;
      phone_number?: string;
      otp: string;
      userId: string;
    }
  ) {
    const tokenData = await this.signupService.verifyOtp(body);
    return {
      success: true,
      verified: true,
      userId: body.userId,
      ...tokenData,
    };
  }

  @Post('signup/complete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete signup after email verification' })
  async signupComplete(
    @Body() body: { userId: string },
    @CurrentUser() auth0User: any
  ) {
    const result = await this.signupService.completeSignup(body.userId, auth0User);
    return { success: true, user: result.user };
  }
}
