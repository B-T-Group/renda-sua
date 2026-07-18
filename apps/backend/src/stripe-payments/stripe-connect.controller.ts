import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { StripeConnectService } from './stripe-connect.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('stripe-connect')
@ApiBearerAuth()
@Controller('stripe-connect')
export class StripeConnectController {
  constructor(
    private readonly connectService: StripeConnectService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  private async userId(ctx: RequestContext): Promise<string> {
    const user = await this.hasuraUserService.getUser(ctx);
    return user.id;
  }

  @Post('account')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the Stripe Connect account for the user' })
  @ApiResponse({ status: 201, description: 'Connect account ensured' })
  async createAccount(@ReqContext() ctx: RequestContext) {
    const userId = await this.userId(ctx);
    const account = await this.connectService.ensureAccount(userId);
    return {
      success: true,
      data: {
        stripeAccountId: account.stripe_account_id,
        status: account.status,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
    };
  }

  @Post('account-link')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get a hosted Connect onboarding link' })
  @ApiResponse({ status: 201, description: 'Onboarding link created' })
  async accountLink(
    @ReqContext() ctx: RequestContext,
    @Body()
    body: {
      returnUrl?: string;
      refreshUrl?: string;
      platform?: 'mobile' | 'web';
    }
  ) {
    const userId = await this.userId(ctx);
    const link = await this.connectService.createOnboardingLink(userId, {
      returnUrl: body?.returnUrl,
      refreshUrl: body?.refreshUrl,
      platform: body?.platform,
    });
    return { success: true, data: link };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get the Connect account onboarding/payout status' })
  @ApiResponse({
    status: 200,
    description:
      'Connect status including connected/charges/payouts/details flags and the resolved payment rail (stripe | mobile_money)',
  })
  async status(@ReqContext() ctx: RequestContext) {
    const userId = await this.userId(ctx);
    const data = await this.connectService.getStatus(userId);
    return { success: true, data };
  }

  @Post('login-link')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get an Express dashboard login link' })
  @ApiResponse({ status: 201, description: 'Login link created' })
  async loginLink(@ReqContext() ctx: RequestContext) {
    const userId = await this.userId(ctx);
    const link = await this.connectService.createLoginLink(userId);
    return { success: true, data: link };
  }
}
