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
  @ApiResponse({ status: 200, description: 'Verification status' })
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
