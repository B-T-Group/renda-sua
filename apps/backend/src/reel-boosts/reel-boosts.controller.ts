import {
  Controller,
  Get,
  NotImplementedException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ReelBoostsService } from './reel-boosts.service';

@ApiTags('reel-boosts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('reel-boosts')
export class ReelBoostsController {
  constructor(
    private readonly boosts: ReelBoostsService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Get('packs')
  @ApiOperation({ summary: 'List reel boost credit packs' })
  listPacks() {
    return { success: true, data: this.boosts.listPacks() };
  }

  @Post('reels/:reelId/boost')
  @ApiOperation({ summary: 'Spend credits to boost a reel for 24h' })
  async boost(@ReqContext() ctx: RequestContext, @Param('reelId') reelId: string) {
    await this.boosts.boostReel(this.hasuraUser.getUserId(ctx), reelId);
    return { success: true };
  }

  @Post('credits/purchase')
  @ApiOperation({ summary: 'Credit reel boost pack after payment confirmation' })
  purchase() {
    throw new NotImplementedException('Use payment callback flow');
  }
}
