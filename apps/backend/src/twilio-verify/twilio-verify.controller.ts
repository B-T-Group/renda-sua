import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TwilioVerifyService } from './twilio-verify.service';
import { AuthGuard } from '../auth/auth.guard';

const HASURA_JWT_CLAIMS_NAMESPACE = 'https://hasura.io/jwt/claims';

@ApiTags('twilio-verify')
@Controller('twilio-verify')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TwilioVerifyController {
  constructor(private readonly twilioVerifyService: TwilioVerifyService) {}

  private extractUserIdFromToken(request: any): string | null {
    try {
      const user = request.user;
      if (!user) return null;

      const claims = user[HASURA_JWT_CLAIMS_NAMESPACE];
      if (!claims) return null;

      return claims['x-hasura-user-id'] || claims['X-Hasura-User-Id'] || null;
    } catch {
      return null;
    }
  }

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start phone number verification via SMS or call' })
  @ApiResponse({
    status: 200,
    description: 'Verification started successfully',
    schema: {
      properties: {
        account_sid: { type: 'string' },
        service_sid: { type: 'string' },
        sid: { type: 'string' },
        status: { type: 'string', example: 'pending' },
        to: { type: 'string' },
        valid: { type: 'boolean' },
        channel: { type: 'string', enum: ['sms', 'call'] },
        date_created: { type: 'string' },
        date_updated: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid phone number or channel',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async startVerification(
    @Body()
    body: {
      phone_number: string;
      channel?: 'sms' | 'call';
    }
  ) {
    const channel = body.channel || 'sms';
    const result = await this.twilioVerifyService.startVerification(
      body.phone_number,
      channel
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone number with code' })
  @ApiResponse({
    status: 200,
    description: 'Code verified successfully',
    schema: {
      properties: {
        account_sid: { type: 'string' },
        service_sid: { type: 'string' },
        sid: { type: 'string' },
        status: { type: 'string', example: 'approved' },
        to: { type: 'string' },
        valid: { type: 'boolean' },
        channel: { type: 'string' },
        date_created: { type: 'string' },
        date_updated: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid code or phone number',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async verifyCode(
    @Request() request: any,
    @Body()
    body: {
      phone_number: string;
      code: string;
    }
  ) {
    const userId = this.extractUserIdFromToken(request);
    const result = await this.twilioVerifyService.verifyCode(
      body.phone_number,
      body.code,
      userId || undefined
    );
    return {
      success: true,
      data: result,
    };
  }
}
