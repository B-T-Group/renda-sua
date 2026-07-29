import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminBroadcastService } from './admin-broadcast.service';
import {
  BroadcastListQueryDto,
  BroadcastPreviewDto,
  CreateBroadcastDto,
} from './dto/admin-broadcast.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

const BODY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-broadcasts')
@Controller('admin/broadcasts')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.OPS_USER_MESSAGES)
@ApiBearerAuth()
export class AdminBroadcastController {
  constructor(private readonly broadcastService: AdminBroadcastService) {}

  @Post('preview')
  @UsePipes(BODY_PIPE)
  @ApiOperation({ summary: 'Preview audience size for a broadcast' })
  @ApiBody({ type: BroadcastPreviewDto })
  @ApiResponse({ status: 200, description: 'Audience counts' })
  async preview(@Body() body: BroadcastPreviewDto) {
    const data = await this.broadcastService.preview({
      audienceType: body.audienceType,
      filters: body.filters,
      messageHash: body.messageHash,
      templateKey: body.templateKey,
      title: body.title,
      body: body.body,
    });
    return { success: true, ...data };
  }

  @Post()
  @UsePipes(BODY_PIPE)
  @ApiOperation({ summary: 'Create and enqueue an admin broadcast campaign' })
  @ApiBody({ type: CreateBroadcastDto })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  async create(@Body() body: CreateBroadcastDto, @Req() req: RequestWithUser) {
    const campaign = await this.broadcastService.createCampaign(
      req.user.id,
      body
    );
    return { success: true, campaign };
  }

  @Get()
  @ApiOperation({ summary: 'List admin broadcast campaigns' })
  @ApiResponse({ status: 200, description: 'Paginated campaign history' })
  async list(@Query() query: BroadcastListQueryDto) {
    const data = await this.broadcastService.listCampaigns(
      Number(query.page) || 1,
      Number(query.limit) || 20
    );
    return { success: true, ...data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin broadcast campaign detail' })
  @ApiResponse({ status: 200, description: 'Campaign detail' })
  async getOne(@Param('id') id: string) {
    const campaign = await this.broadcastService.getCampaign(id);
    return { success: true, campaign };
  }
}
