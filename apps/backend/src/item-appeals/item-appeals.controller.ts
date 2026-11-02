import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BusinessItemsAccessService } from '../business-items/business-items-access.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { AiCleanupQuoteQueryDto, CreateItemAppealDto, ResubmitItemDto, SetItemConditionDto } from './dto/item-appeals.dto';
import { ItemAppealsService } from './item-appeals.service';

const PIPE = new ValidationPipe({ transform: true, whitelist: true });

/**
 * Business side of rejected-item recovery (B1–B8). Own business only: platform
 * admins acting cross-business get ITEM_APPEAL_NOT_OWNER (appeals are the merchant's voice).
 */
@ApiTags('business-items')
@Controller('business-items')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ItemAppealsController {
  constructor(
    private readonly appeals: ItemAppealsService,
    private readonly access: BusinessItemsAccessService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Get('rejection-actions')
  @ApiOperation({ summary: 'Category → recovery actions map (B8)' })
  rejectionActions() {
    return { success: true, data: this.appeals.rejectionActions() };
  }

  @Get('items/:itemId/recovery')
  @ApiOperation({ summary: 'Recovery panel state for one item (B1/B3/B4/B8)' })
  async recovery(@Param('itemId', ParseUUIDPipe) itemId: string) {
    const businessId = await this.ownBusinessId();
    return { success: true, data: await this.appeals.getRecovery(businessId, itemId) };
  }

  @Get('items/:itemId/ai-cleanup-quote')
  @ApiQuery({ name: 'imageCount', type: Number })
  async quote(@Param('itemId', ParseUUIDPipe) itemId: string, @Query(PIPE) q: AiCleanupQuoteQueryDto) {
    const businessId = await this.ownBusinessId();
    return { success: true, data: await this.appeals.cleanupQuote(businessId, itemId, q.imageCount) };
  }

  @Post('items/:itemId/appeals')
  async createAppeal(@Param('itemId', ParseUUIDPipe) itemId: string, @Body(PIPE) body: CreateItemAppealDto) {
    const { businessId, userId } = await this.actor();
    return { success: true, data: { appeal: await this.appeals.createAppeal(businessId, userId, itemId, body) } };
  }

  @Post('items/:itemId/appeals/:appealId/withdraw')
  async withdraw(@Param('itemId', ParseUUIDPipe) itemId: string, @Param('appealId', ParseUUIDPipe) appealId: string) {
    const { businessId, userId } = await this.actor();
    return { success: true, data: await this.appeals.withdrawAppeal(businessId, userId, itemId, appealId) };
  }

  @Post('items/:itemId/resubmit')
  async resubmit(@Param('itemId', ParseUUIDPipe) itemId: string, @Body(PIPE) body: ResubmitItemDto) {
    const { businessId, userId } = await this.actor();
    return { success: true, data: await this.appeals.resubmit(businessId, userId, itemId, body ?? {}) };
  }

  @Patch('items/:itemId/condition')
  async condition(@Param('itemId', ParseUUIDPipe) itemId: string, @Body(PIPE) body: SetItemConditionDto) {
    const { businessId, userId } = await this.actor();
    return { success: true, data: await this.appeals.setCondition(businessId, userId, itemId, body) };
  }

  private async ownBusinessId(): Promise<string> {
    return (await this.access.resolveAccess()).ownBusinessId;
  }

  private async actor(): Promise<{ businessId: string; userId: string }> {
    const ctx = await this.access.resolveAccess();
    const user = await this.hasuraUser.getUser();
    return { businessId: ctx.ownBusinessId, userId: user.id };
  }
}
