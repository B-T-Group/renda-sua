import {
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { FacebookCatalogFeedService } from './facebook-catalog-feed.service';

@ApiTags('feeds')
@Controller('feeds')
export class FacebookCatalogFeedController {
  constructor(
    private readonly feedService: FacebookCatalogFeedService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Get('facebook-catalog.csv')
  @ApiOperation({
    summary:
      'Platform-wide Facebook product catalog CSV feed (token-protected)',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'FACEBOOK_CATALOG_FEED_TOKEN value',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'Facebook catalog CSV' })
  @ApiResponse({ status: 401, description: 'Invalid or missing token' })
  async getFacebookCatalogCsv(
    @Query('token') token: string | undefined,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    this.assertFeedToken(token);
    const { csv } = await this.feedService.buildCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  }

  private assertFeedToken(token?: string): void {
    const expected =
      this.configService.get<Configuration['facebookCatalogFeed']>(
        'facebookCatalogFeed'
      )?.token ?? '';
    if (!expected || token !== expected) {
      throw new UnauthorizedException();
    }
  }
}
