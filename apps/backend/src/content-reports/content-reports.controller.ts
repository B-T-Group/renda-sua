import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { ContentReportsService } from './content-reports.service';
import { SubmitContentReportDto } from './dto/submit-content-report.dto';
import { ResolveContentReportDto } from './dto/resolve-content-report.dto';

@ApiTags('content-reports')
@Controller('content-reports')
export class ContentReportsController {
  constructor(private readonly contentReportsService: ContentReportsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a content report' })
  @ApiResponse({ status: 201, description: 'Report submitted' })
  async submit(
    @Body() body: SubmitContentReportDto,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = ctx.userId;
    if (!userId) throw new UnauthorizedException();
    const row = await this.contentReportsService.submitReport({
      reporterUserId: userId,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      reason: body.reason,
      details: body.details,
    });
    return {
      success: true,
      data: row,
      message: 'Report submitted successfully',
    };
  }

  @Post('block-business/:businessId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Block a merchant content (reels, etc.)' })
  @ApiParam({ name: 'businessId', format: 'uuid' })
  async blockBusiness(
    @Param('businessId') businessId: string,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = ctx.userId;
    if (!userId) throw new UnauthorizedException();
    const data = await this.contentReportsService.blockBusiness(
      userId,
      businessId
    );
    return { success: true, data, message: 'Business blocked' };
  }

  @Get('admin/queue')
  @UseGuards(AuthGuard, AdminAuthGuard)
  @RequirePermissions(PlatformPermissions.MODERATE_ITEMS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin content reports queue' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async adminQueue(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const data = await this.contentReportsService.listQueue({
      status,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return {
      success: true,
      data,
      message: 'Content reports queue retrieved',
    };
  }

  @Patch('admin/:reportId/resolve')
  @UseGuards(AuthGuard, AdminAuthGuard)
  @RequirePermissions(PlatformPermissions.MODERATE_ITEMS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a content report' })
  @ApiParam({ name: 'reportId', format: 'uuid' })
  async resolve(
    @Param('reportId') reportId: string,
    @Body() body: ResolveContentReportDto,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = ctx.userId;
    if (!userId) throw new UnauthorizedException();
    try {
      const row = await this.contentReportsService.resolveReport({
        reportId,
        resolverUserId: userId,
        action: body.action,
        resolution: body.resolution,
      });
      return { success: true, data: row, message: 'Report resolved' };
    } catch (error: any) {
      if (error?.status) throw error;
      throw new HttpException(
        { success: false, message: error?.message || 'Failed to resolve' },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
