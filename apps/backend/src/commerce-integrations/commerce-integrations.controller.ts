import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CommerceConnectionService } from './commerce-connection.service';
import { CommerceImportService } from './commerce-import.service';
import { CommerceInventorySyncService } from './commerce-inventory-sync.service';
import { CommerceMappingService } from './commerce-mapping.service';
import { CommerceIntegrationsDatabaseService } from './commerce-integrations-database.service';
import { CommerceWebhookService } from './commerce-webhook.service';
import { BusinessItemsAccessService } from '../business-items/business-items-access.service';
import {
  ImportProductsDto,
  SaveLocationMappingsDto,
  ShopifyInstallDto,
} from './dto/commerce-integrations.dto';

@ApiTags('commerce-integrations')
@Controller('commerce-integrations')
export class CommerceIntegrationsController {
  constructor(
    private readonly connection: CommerceConnectionService,
    private readonly mapping: CommerceMappingService,
    private readonly importService: CommerceImportService,
    private readonly inventorySync: CommerceInventorySyncService,
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly access: BusinessItemsAccessService
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List commerce integrations for the business' })
  async list(@Query('businessId') businessId?: string) {
    const data = await this.connection.listForCurrentBusiness(businessId);
    return { success: true, data };
  }

  @Post('shopify/install')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start Shopify OAuth install' })
  async shopifyInstall(@Body() body: ShopifyInstallDto) {
    const data = await this.connection.startShopifyInstall(body);
    return { success: true, data };
  }

  @Get('shopify/callback')
  @Public()
  @ApiOperation({ summary: 'Shopify OAuth callback' })
  async shopifyCallback(
    @Query('code') code: string | undefined,
    @Query('shop') shop: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response
  ) {
    const result = await this.connection.handleShopifyCallback({
      code,
      shop,
      state,
    });
    return res.redirect(result.redirectUrl);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect a commerce integration' })
  async disconnect(
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const data = await this.connection.disconnect(id, businessId);
    return { success: true, data };
  }

  @Get(':id/locations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List external locations and mappings' })
  async locations(
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const data = await this.mapping.listExternalLocations(id, businessId);
    return { success: true, data };
  }

  @Put(':id/location-mappings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save location mappings' })
  async saveLocationMappings(
    @Param('id') id: string,
    @Body() body: SaveLocationMappingsDto
  ) {
    const data = await this.mapping.saveLocationMappings(
      id,
      body.mappings.map((m) => ({
        externalId: m.externalId,
        internalId: m.internalId ?? null,
        syncEnabled: m.syncEnabled,
      })),
      body.businessId
    );
    return { success: true, data };
  }

  @Get(':id/products/preview')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview external products for import' })
  async previewProducts(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('businessId') businessId?: string
  ) {
    const data = await this.importService.previewProducts(
      id,
      cursor,
      businessId
    );
    return { success: true, data };
  }

  @Post(':id/products/import')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import selected external products as drafts' })
  async importProducts(
    @Param('id') id: string,
    @Body() body: ImportProductsDto
  ) {
    const data = await this.importService.importProducts(
      id,
      body.externalProductIds,
      {
        businessId: body.businessId,
        defaultSubCategoryId: body.defaultSubCategoryId,
        importInventory: body.importInventory,
      }
    );
    return { success: true, data };
  }

  @Post(':id/sync')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Queue a manual inventory reconciliation' })
  async sync(
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const data = await this.inventorySync.manualSync(id, businessId);
    return { success: true, data };
  }

  @Get(':id/sync-runs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List recent sync runs' })
  async syncRuns(
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.access.resolveAccess(businessId);
    await this.connection.requireOwnedIntegration(id, ctx.targetBusinessId);
    const data = await this.db.listSyncRuns(id);
    return { success: true, data };
  }

  @Put(':id/feature-flags')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update integration feature flags (e.g. outbound inventory sync)',
  })
  async updateFeatureFlags(
    @Param('id') id: string,
    @Body()
    body: {
      businessId?: string;
      inboundInventorySyncEnabled?: boolean;
      outboundInventorySyncEnabled?: boolean;
    }
  ) {
    const ctx = await this.access.resolveAccess(body.businessId);
    const integration = await this.connection.requireOwnedIntegration(
      id,
      ctx.targetBusinessId
    );
    const next = {
      ...(integration.feature_flags || {}),
      ...(body.inboundInventorySyncEnabled !== undefined
        ? { inboundInventorySyncEnabled: body.inboundInventorySyncEnabled }
        : {}),
      ...(body.outboundInventorySyncEnabled !== undefined
        ? { outboundInventorySyncEnabled: body.outboundInventorySyncEnabled }
        : {}),
    };
    await this.db.updateIntegration(id, { feature_flags: next });
    return { success: true, data: { featureFlags: next } };
  }
}

@ApiTags('commerce-integrations')
@Controller('commerce-integrations')
export class CommerceIntegrationsWebhookController {
  constructor(private readonly webhookService: CommerceWebhookService) {}

  @Post('webhooks/shopify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify webhook receiver' })
  @ApiResponse({ status: 200, description: 'Accepted' })
  @ApiResponse({ status: 401, description: 'Invalid HMAC' })
  async shopifyWebhook(
    @Req() req: { body?: Buffer; rawBody?: Buffer; headers: Record<string, unknown> },
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const rawBody =
      (req as any).rawBody ||
      (Buffer.isBuffer(req.body) ? req.body : Buffer.from(''));
    const result = await this.webhookService.handleShopifyWebhook(
      rawBody,
      headers
    );
    if (!result.accepted) {
      throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }
    return { success: true };
  }
}

@ApiTags('commerce-integrations-internal')
@Controller('commerce-integrations/internal')
export class CommerceIntegrationsInternalController {
  constructor(private readonly webhookService: CommerceWebhookService) {}

  @Post('process')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal worker to process commerce sync messages' })
  async process(
    @Headers('x-rendasua-internal-key') key: string | undefined,
    @Body() body: unknown
  ) {
    const expected =
      process.env.NOTIFICATIONS_INTERNAL_API_KEY ||
      process.env.RENDASUA_INTERNAL_API_KEY ||
      '';
    if (!expected || key !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    await this.webhookService.processQueueMessage(body as any);
    return { success: true };
  }
}
