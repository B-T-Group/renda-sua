import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { ThreadsService } from './threads.service';

class ReplyDto {
  body!: string;
}

@ApiTags('threads')
@Controller('threads')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  @ApiOperation({ summary: 'List my conversation threads' })
  @ApiResponse({ status: 200, description: 'Thread list' })
  async listMyThreads(@ReqContext() ctx: RequestContext) {
    return this.threadsService.listMyThreads(ctx.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get thread detail with messages' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({ status: 200, description: 'Thread detail' })
  async getThread(@Param('id') id: string, @ReqContext() ctx: RequestContext) {
    return this.threadsService.getThread(ctx.userId, id);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reply to a thread' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiBody({ schema: { properties: { body: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Message created' })
  async reply(
    @Param('id') id: string,
    @Body() dto: ReplyDto,
    @ReqContext() ctx: RequestContext
  ) {
    return this.threadsService.replyToThread({ userId: ctx.userId, threadId: id, body: dto.body });
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark thread as read' })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({ status: 204, description: 'Marked as read' })
  async markRead(@Param('id') id: string, @ReqContext() ctx: RequestContext) {
    await this.threadsService.markThreadRead(ctx.userId, id);
  }
}
