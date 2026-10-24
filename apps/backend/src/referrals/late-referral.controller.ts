import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { ApplyReferralDto } from '../admin/dto/apply-referral.dto';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LateReferralService } from './late-referral.service';

@ApiTags('referrals')
@Controller('referrals/late')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class LateReferralController {
  constructor(
    private readonly lateReferralService: LateReferralService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Whether the current user can enter a referral code late',
  })
  @ApiResponse({ status: 200, description: 'Late referral status' })
  async status(@ReqContext() ctx: RequestContext) {
    const userId = await this.requireUserId(ctx);
    const data = await this.lateReferralService.getStatus(userId);
    return { success: true, data };
  }

  @Throttle({ short: { limit: 10, ttl: 600000 } })
  @Get('lookup/:code')
  @ApiOperation({ summary: 'Look up a referrer by code (masked name)' })
  @ApiParam({ name: 'code', description: '6-character referral code' })
  async lookup(
    @ReqContext() ctx: RequestContext,
    @Param('code') code: string
  ) {
    const userId = await this.requireUserId(ctx);
    const data = await this.lateReferralService.lookup(userId, code);
    return { success: true, data };
  }

  @Throttle({ short: { limit: 5, ttl: 86400000 } })
  @Post()
  @ApiOperation({ summary: 'Apply a referral code within 30 days of signup' })
  @ApiBody({ type: ApplyReferralDto })
  @ApiResponse({ status: 200, description: 'Referral applied' })
  async apply(
    @ReqContext() ctx: RequestContext,
    @Body() body: ApplyReferralDto
  ) {
    const userId = await this.requireUserId(ctx);
    const data = await this.lateReferralService.apply(userId, body.code);
    return { success: true, data };
  }

  private async requireUserId(ctx: RequestContext): Promise<string> {
    const user = await this.hasuraUserService.getUser(ctx);
    if (!user?.id) {
      throw new HttpException(
        { success: false, error: 'Unauthorized' },
        HttpStatus.UNAUTHORIZED
      );
    }
    return user.id;
  }
}
