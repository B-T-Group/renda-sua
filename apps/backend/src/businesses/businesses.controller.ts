import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { BusinessReferralsService } from '../business-referrals/business-referrals.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Public()
  @Get('public/by-code/:businessCode')
  @ApiOperation({
    summary: 'Get business name by referral code (public)',
    description:
      'Public endpoint that returns the display name of a business given their 6-character referral code.',
  })
  @ApiParam({
    name: 'businessCode',
    description: 'Business referral code (6-character alphanumeric)',
    example: 'AB12CD',
  })
  @ApiResponse({
    status: 200,
    description: 'Business found for given code',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        businessCode: { type: 'string', example: 'AB12CD' },
        businessName: { type: 'string', example: 'Acme Store' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No business found for the provided code',
  })
  async getBusinessByReferralCode(
    @Param('businessCode') businessCode: string
  ) {
    const normalized =
      this.businessReferralsService.normalizeReferralCode(businessCode);
    if (!normalized) {
      throw new HttpException(
        { success: false, error: 'Invalid referral code format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const lookup =
      await this.businessReferralsService.findBusinessByCode(normalized);
    if (!lookup || lookup.lifecycleStatus === 'suspended') {
      throw new HttpException(
        { success: false, error: 'Business not found' },
        HttpStatus.NOT_FOUND
      );
    }

    return {
      success: true,
      businessCode: normalized,
      businessName: lookup.businessName,
    };
  }

  @Get('me/referred-businesses')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List businesses referred by the current business',
  })
  @ApiResponse({ status: 200, description: 'Referred businesses list' })
  async getMyReferredBusinesses(@ReqContext() ctx: RequestContext) {
    const user = await this.hasuraUserService.getUser(ctx);
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'Business profile required' },
        HttpStatus.FORBIDDEN
      );
    }
    const businesses =
      await this.businessReferralsService.listReferredBusinesses(businessId);
    return { success: true, businesses };
  }

  @Get('me/referrals-summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get business referral code and referral summary for current business',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral summary',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        businessCode: { type: 'string' },
        referralAmount: { type: 'number' },
        currency: { type: 'string' },
        countryCode: { type: 'string', nullable: true },
        minApprovedItems: { type: 'number' },
        referredCount: { type: 'number' },
        paidCount: { type: 'number' },
      },
    },
  })
  async getMyReferralsSummary(@ReqContext() ctx: RequestContext) {
    const user = await this.hasuraUserService.getUser(ctx);
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'Business profile required' },
        HttpStatus.FORBIDDEN
      );
    }
    const summary =
      await this.businessReferralsService.getReferralsSummary(businessId);
    return { success: true, ...summary };
  }
}
