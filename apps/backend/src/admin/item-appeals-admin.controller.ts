import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppealsQueueQueryDto, DecideItemAppealDto } from '../item-appeals/dto/item-appeals.dto';
import { ItemAppealsService } from '../item-appeals/item-appeals.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminAuthGuard } from './admin-auth.guard';

const PIPE = new ValidationPipe({ transform: true, whitelist: true });

interface RequestWithUser extends Request {
  user: { id: string };
}

/** Admin appeals queue + decision (A1–A5). Same permission as item moderation. */
@ApiTags('admin')
@Controller('admin/item-appeals')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.MODERATE_ITEMS)
@ApiBearerAuth()
export class ItemAppealsAdminController {
  constructor(private readonly appeals: ItemAppealsService) {}

  @Get()
  @ApiOperation({ summary: 'Appeals queue, SLA-due first (A1)' })
  async list(@Query(PIPE) q: AppealsQueueQueryDto) {
    return { success: true, data: await this.appeals.listQueue(q) };
  }

  @Get('count')
  @ApiOperation({ summary: 'Pending + breached counts for the nav badge (A1)' })
  async count() {
    return { success: true, data: await this.appeals.counts() };
  }

  @Get(':appealId')
  @ApiOperation({ summary: 'Appeal detail with rejection snapshot and item history (A2/A3)' })
  async detail(@Param('appealId', ParseUUIDPipe) appealId: string, @Req() req: RequestWithUser) {
    return { success: true, data: await this.appeals.detail(appealId, req.user.id) };
  }

  @Post(':appealId/decide')
  @ApiOperation({ summary: 'Uphold or overturn (A2/A4/A5)' })
  async decide(
    @Param('appealId', ParseUUIDPipe) appealId: string,
    @Body(PIPE) body: DecideItemAppealDto,
    @Req() req: RequestWithUser
  ) {
    return { success: true, data: await this.appeals.decide(appealId, req.user.id, body) };
  }
}
