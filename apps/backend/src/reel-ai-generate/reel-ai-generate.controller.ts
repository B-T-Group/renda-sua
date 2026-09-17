import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { GenerateAiReelDto } from './dto/generate-ai-reel.dto';
import { ReelAiGenerateService } from './reel-ai-generate.service';

@ApiTags('reels')
@Controller('reels')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ReelAiGenerateController {
  constructor(
    private readonly generate: ReelAiGenerateService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Get('ai/presets')
  @ApiOperation({ summary: 'List AI reel prompt presets' })
  @ApiResponse({ status: 200, description: 'Preset catalog' })
  listPresets() {
    return { success: true, data: this.generate.listPresets() };
  }

  @Post('ai-generate')
  @ApiOperation({ summary: 'Generate an 8s AI product-ad reel' })
  @ApiResponse({ status: 201, description: 'AI reel generation started' })
  @ApiResponse({ status: 402, description: 'Insufficient AI reel tokens' })
  generateReel(
    @ReqContext() ctx: RequestContext,
    @Body() dto: GenerateAiReelDto
  ) {
    return this.generate.generate(this.hasuraUser.getUserId(ctx), dto);
  }
}
