import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessTokensService } from './business-tokens.service';
import { BusinessTokenGiftsService } from './business-token-gifts.service';
import { PurchaseTokenPackDto } from './dto/purchase-token-pack.dto';
import { GiftAiTokensDto } from './dto/gift-ai-tokens.dto';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('business-tokens')
@Controller('business-tokens')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessTokensController {
  constructor(
    private readonly businessTokensService: BusinessTokensService,
    private readonly businessTokenGiftsService: BusinessTokenGiftsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('packs')
  @ApiOperation({ summary: 'List available AI token packs and prices' })
  @ApiResponse({ status: 200, description: 'Pack catalog' })
  listPacks() {
    return { success: true, data: this.businessTokensService.listPacks() };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get AI token balance for the current business' })
  @ApiResponse({ status: 200, description: 'Token balance' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getBalance(@ReqContext() ctx: RequestContext) {
    const businessId = await this.requireBusinessId(ctx);
    const data =
      await this.businessTokensService.getBalanceDetails(businessId);
    return { success: true, data };
  }

  @Get('usage')
  @ApiOperation({ summary: 'List recent AI token usage for the current business' })
  @ApiResponse({ status: 200, description: 'Usage history' })
  async listUsage(@ReqContext() ctx: RequestContext, @Query('limit') limit?: string) {
    const businessId = await this.requireBusinessId(ctx);
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    const data = await this.businessTokensService.listUsage(
      businessId,
      Number.isFinite(parsed) ? Math.min(parsed, 100) : 50
    );
    return { success: true, data };
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase an AI token pack' })
  @ApiResponse({ status: 200, description: 'Payment initiated' })
  @ApiResponse({ status: 400, description: 'Invalid pack or payment request' })
  async purchase(@Body() dto: PurchaseTokenPackDto) {
    const data = await this.businessTokensService.initiatePackPurchase({
      packId: dto.packId,
      phoneNumber: dto.phoneNumber,
      stripePaymentMethod: dto.stripePaymentMethod,
    });
    return { success: true, data };
  }

  @Throttle({ short: { limit: 10, ttl: 600000 } })
  @Get('gift-lookup/:code')
  @ApiOperation({
    summary: 'Look up a gift recipient by referral code (masked name)',
  })
  @ApiParam({ name: 'code', description: '6-character referral code' })
  @ApiResponse({ status: 200, description: 'Recipient found' })
  @ApiResponse({ status: 404, description: 'Code not found' })
  async giftLookup(
    @ReqContext() ctx: RequestContext,
    @Param('code') code: string
  ) {
    const { businessId, userId } = await this.requireBusinessActor(ctx);
    const data = await this.businessTokenGiftsService.lookupRecipient(
      code,
      userId,
      businessId
    );
    return {
      success: true,
      data: { maskedName: data.maskedName, referralCode: data.referralCode },
    };
  }

  @Post('gifts')
  @ApiOperation({ summary: 'Gift AI image tokens to another business' })
  @ApiResponse({ status: 200, description: 'Gift sent' })
  async sendGift(
    @ReqContext() ctx: RequestContext,
    @Body() dto: GiftAiTokensDto
  ) {
    const { businessId, userId } = await this.requireBusinessActor(ctx);
    const data = await this.businessTokenGiftsService.sendGift({
      senderBusinessId: businessId,
      senderUserId: userId,
      code: dto.code,
      amount: dto.amount,
      idempotencyKey: dto.idempotencyKey,
    });
    return { success: true, data };
  }

  @Get('gifts')
  @ApiOperation({ summary: 'List AI token gifts sent and received' })
  async listGifts(
    @ReqContext() ctx: RequestContext,
    @Query('limit') limit?: string
  ) {
    const businessId = await this.requireBusinessId(ctx);
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    const data = await this.businessTokenGiftsService.listGifts(
      businessId,
      Number.isFinite(parsed) ? Math.min(parsed, 100) : 50
    );
    return { success: true, data };
  }

  private async requireBusinessId(ctx: RequestContext): Promise<string> {
    const { businessId } = await this.requireBusinessActor(ctx);
    return businessId;
  }

  private async requireBusinessActor(
    ctx: RequestContext
  ): Promise<{ businessId: string; userId: string }> {
    const user = await this.hasuraUserService.getUser(ctx);
    if (!user?.business?.id || !user?.id) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return { businessId: user.business.id, userId: user.id };
  }
}
