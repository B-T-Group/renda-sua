import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PurchaseReelAiTokenPackDto } from './dto/purchase-reel-ai-token-pack.dto';
import { ReelAiTokensService } from './reel-ai-tokens.service';

@ApiTags('reel-ai-tokens')
@Controller('reel-ai-tokens')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ReelAiTokensController {
  constructor(
    private readonly reelAiTokensService: ReelAiTokensService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('packs')
  @ApiOperation({ summary: 'List AI reel token packs and prices' })
  @ApiResponse({ status: 200, description: 'Pack catalog' })
  listPacks() {
    return { success: true, data: this.reelAiTokensService.listPacks() };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get AI reel token balance for the current business' })
  @ApiResponse({ status: 200, description: 'Token balance' })
  async getBalance(@ReqContext() ctx: RequestContext) {
    const businessId = await this.requireBusinessId(ctx);
    const ai_reel_tokens =
      await this.reelAiTokensService.getBalance(businessId);
    return { success: true, data: { ai_reel_tokens } };
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase an AI reel token pack' })
  @ApiResponse({ status: 200, description: 'Payment initiated' })
  async purchase(@Body() dto: PurchaseReelAiTokenPackDto) {
    const data = await this.reelAiTokensService.initiatePackPurchase({
      packId: dto.packId,
      phoneNumber: dto.phoneNumber,
      stripePaymentMethod: dto.stripePaymentMethod,
    });
    return { success: true, data };
  }

  private async requireBusinessId(ctx: RequestContext): Promise<string> {
    const user = await this.hasuraUserService.getUser(ctx);
    if (!user?.business?.id) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return user.business.id;
  }
}
