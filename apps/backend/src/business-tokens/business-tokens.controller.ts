import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessTokensService } from './business-tokens.service';
import { PurchaseTokenPackDto } from './dto/purchase-token-pack.dto';

@ApiTags('business-tokens')
@Controller('business-tokens')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessTokensController {
  constructor(
    private readonly businessTokensService: BusinessTokensService,
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
  async getBalance() {
    const businessId = await this.requireBusinessId();
    const ai_tokens = await this.businessTokensService.getBalance(businessId);
    return { success: true, data: { ai_tokens } };
  }

  @Get('usage')
  @ApiOperation({ summary: 'List recent AI token usage for the current business' })
  @ApiResponse({ status: 200, description: 'Usage history' })
  async listUsage(@Query('limit') limit?: string) {
    const businessId = await this.requireBusinessId();
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

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    if (!user?.business?.id) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return user.business.id;
  }
}
