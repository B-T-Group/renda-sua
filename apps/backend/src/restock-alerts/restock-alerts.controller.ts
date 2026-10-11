import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  ItemIdParamDto,
  PatchRestockPreferencesDto,
  RestockLikesQueryDto,
  SetItemAlertDto,
  StopRestockAlertsDto,
} from './dto/restock-alerts.dto';
import { RestockAlertsApiService } from './restock-alerts-api.service';

@ApiTags('restock-alerts')
@Controller('restock-alerts')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class RestockAlertsController {
  constructor(
    private readonly api: RestockAlertsApiService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  private userId(ctx: RequestContext): string {
    const id = this.hasuraUser.getUserId(ctx);
    if (!id || id === 'anonymous') throw new UnauthorizedException();
    return id;
  }

  @Get('status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Is restock alerts v1 on for this user (market)?' })
  async status(@ReqContext() ctx: RequestContext) {
    return { success: true, data: { enabled: await this.api.isEnabledForUser(this.userId(ctx)) } };
  }

  @Get('preferences')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getPreferences(@ReqContext() ctx: RequestContext) {
    const userId = this.userId(ctx);
    await this.api.assertEnabled(userId);
    return { success: true, data: await this.api.getPreferences(userId) };
  }

  @Patch('preferences')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async patchPreferences(
    @Body() body: PatchRestockPreferencesDto,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = this.userId(ctx);
    await this.api.assertEnabled(userId);
    return { success: true, data: await this.api.patchPreferences(userId, body) };
  }

  @Put('items/:itemId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async setItemAlert(
    @Param() params: ItemIdParamDto,
    @Body() body: SetItemAlertDto,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = this.userId(ctx);
    await this.api.assertEnabled(userId);
    return { success: true, data: await this.api.setItemAlert(userId, params.itemId, body.enabled) };
  }

  @Delete('items/:itemId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async disarmItem(@Param() params: ItemIdParamDto, @ReqContext() ctx: RequestContext) {
    const userId = this.userId(ctx);
    await this.api.assertEnabled(userId);
    return { success: true, data: await this.api.setItemAlert(userId, params.itemId, false) };
  }

  @Get('likes')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liked items with bell state and back_in_stock' })
  async likes(@Query() query: RestockLikesQueryDto, @ReqContext() ctx: RequestContext) {
    const userId = this.userId(ctx);
    await this.api.assertEnabled(userId);
    const data = await this.api.listLikes(
      userId,
      query.filter ?? 'all',
      query.page ?? 1,
      query.limit ?? 20
    );
    return { success: true, data };
  }

  /** Public on purpose: the signed single-use token is the credential (push action, link). */
  @Post('stop')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Stop restock alerts for one channel from a message' })
  async stop(@Body() body: StopRestockAlertsDto) {
    return { success: true, data: await this.api.stopFromMessage(body.token) };
  }
}
