import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { AgentContractsService } from './agent-contracts.service';
import { EnsureAgentContractDto } from './dto/ensure-agent-contract.dto';

@ApiTags('agent-contracts')
@Controller('agent-contracts')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@Throttle({ short: { limit: 20, ttl: 60000 } })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AgentContractsController {
  constructor(
    private readonly contracts: AgentContractsService,
    private readonly users: HasuraUserService
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Agent agreement status. Sends the email when it can.' })
  @ApiResponse({ status: 200, description: 'Agreement status' })
  async status(@ReqContext() ctx: RequestContext) {
    const userId = await this.requireUserId(ctx);
    return { success: true, data: await this.contracts.statusForUser(userId) };
  }

  @Post('ensure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send the agent agreement after required details' })
  @ApiResponse({ status: 200, description: 'Agreement status after send' })
  async ensure(@ReqContext() ctx: RequestContext, @Body() body: EnsureAgentContractDto) {
    const userId = await this.requireUserId(ctx);
    await this.contracts.ensureForUser(userId, body);
    return { success: true, data: await this.contracts.refreshForUser(userId) };
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remind the signer or send the agreement again' })
  @ApiResponse({ status: 200, description: 'Agreement status after resend' })
  async resend(@ReqContext() ctx: RequestContext, @Body() body: EnsureAgentContractDto) {
    const userId = await this.requireUserId(ctx);
    return { success: true, data: await this.contracts.resendForUser(userId, body) };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a completed BoldSign agent agreement' })
  @ApiResponse({ status: 200, description: 'Agreement status after refresh' })
  async refresh(@ReqContext() ctx: RequestContext) {
    const userId = await this.requireUserId(ctx);
    return { success: true, data: await this.contracts.refreshForUser(userId) };
  }

  private async requireUserId(ctx: RequestContext): Promise<string> {
    const user = await this.users.getUser(ctx);
    if (!user?.id || !user.agent?.id) {
      throw new HttpException('Agent profile required', HttpStatus.FORBIDDEN);
    }
    return user.id;
  }
}
