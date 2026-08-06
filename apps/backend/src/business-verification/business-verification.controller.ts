import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { BusinessVerificationService } from './business-verification.service';
import { AcceptMerchantAgreementDto } from './dto/accept-merchant-agreement.dto';

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

@ApiTags('business-verification')
@Controller('business-verification')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessVerificationController {
  constructor(
    private readonly businessVerificationService: BusinessVerificationService
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get business account verification status' })
  @ApiResponse({
    status: 200,
    description:
      'Verification status including nextAction, steps, lifecycle flags, and requiresMerchantAction (true when the merchant still has a setup step to complete)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            is_verified: { type: 'boolean' },
            nextAction: {
              type: 'string',
              enum: [
                'sign_agreement',
                'upload_id',
                'setup_stripe_connect',
                'publish_catalog',
                'pending_review',
                'verify_mobile_payment_phone',
                'complete',
              ],
            },
            requiresMerchantAction: {
              type: 'boolean',
              description:
                'True when nextAction is a merchant setup step (agreement, payouts/ID, or phone)',
            },
            paymentRail: {
              type: 'string',
              enum: ['stripe', 'mobile_money'],
            },
            lifecycle_status: { type: 'string' },
            is_storefront_visible: { type: 'boolean' },
            can_accept_orders: { type: 'boolean' },
            suspension: {
              type: 'object',
              nullable: true,
              properties: {
                code: {
                  type: 'string',
                  enum: ['reliability_missed_orders', 'admin', 'unknown'],
                },
                suspendedAt: { type: 'string', nullable: true },
              },
            },
            steps: { type: 'object' },
          },
        },
      },
    },
  })
  async getStatus() {
    const data = await this.businessVerificationService.getStatus();
    return { success: true, data };
  }

  @Get('merchant-agreement')
  @ApiOperation({ summary: 'Get current merchant agreement text' })
  async getMerchantAgreement() {
    const data = await this.businessVerificationService.getMerchantAgreementForUser();
    return { success: true, data };
  }

  @Post('merchant-agreement/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept the merchant partnership agreement' })
  @ApiBody({ type: AcceptMerchantAgreementDto })
  async acceptAgreement(
    @Body() body: AcceptMerchantAgreementDto,
    @Req() req: Request
  ) {
    const data = await this.businessVerificationService.acceptAgreement(
      body,
      clientIp(req),
      req.headers['user-agent']
    );
    return { success: true, data };
  }
}
