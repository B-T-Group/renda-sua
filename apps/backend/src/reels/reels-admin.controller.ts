import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ModerateReelDto } from './dto/reels.dto';
import { ReelsService } from './reels.service';

interface AdminRequest extends Request {
  user: { id: string };
}

@ApiTags('admin-reels')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/reels')
export class ReelsAdminController {
  constructor(private readonly reels: ReelsService) {}

  @Get('moderation')
  @ApiOperation({ summary: 'List reels awaiting moderation' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Moderation queue returned' })
  queue(@Query('limit') limit?: string) {
    return this.reels.moderationQueue(Number(limit) || 50);
  }

  @Patch(':reelId/moderation')
  @ApiOperation({ summary: 'Approve or reject a reel' })
  @ApiResponse({ status: 200, description: 'Moderation decision applied' })
  async moderate(
    @Param('reelId') reelId: string,
    @Body() dto: ModerateReelDto,
    @Req() request: AdminRequest
  ) {
    await this.reels.moderate(reelId, request.user.id, dto);
    return { success: true };
  }
}
