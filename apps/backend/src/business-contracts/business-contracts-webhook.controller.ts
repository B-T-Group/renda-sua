import {
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import type { BoldSignConfig, Configuration } from '../config/configuration';
import { verifyBoldSignWebhookSecret } from './boldsign-webhook-auth.util';
import { BusinessContractsService } from './business-contracts.service';
import type { BoldSignWebhookPayload } from './business-contracts.types';

@ApiTags('business-contracts')
@Controller('business-contracts')
export class BusinessContractsWebhookController {
  private readonly logger = new Logger(BusinessContractsWebhookController.name);

  constructor(
    private readonly contractsService: BusinessContractsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  private get boldSignConfig(): BoldSignConfig {
    return this.configService.get<BoldSignConfig>('boldsign') as BoldSignConfig;
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BoldSign webhook receiver' })
  async webhook(
    @Req() req: Request,
    @Headers('x-boldsign-webhook-secret') webhookSecret?: string
  ) {
    const rawBody = (req as unknown as { body: Buffer }).body;

    let payload: BoldSignWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as BoldSignWebhookPayload;
    } catch (error: any) {
      throw new HttpException(
        { received: false, message: 'Invalid JSON' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (payload.event?.eventType === 'Verification') {
      this.logger.log(
        `BoldSign webhook verification handshake received (env=${payload.event.environment ?? 'unknown'})`
      );
      return { received: true };
    }

    const authValid = verifyBoldSignWebhookSecret(
      webhookSecret,
      this.boldSignConfig.webhookSigningSecret
    );
    if (!authValid) {
      throw new HttpException(
        { received: false, message: 'Invalid webhook secret' },
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      await this.contractsService.handleWebhookEvent(payload, authValid);
      return { received: true };
    } catch (error: any) {
      this.logger.error(`BoldSign webhook processing failed: ${error?.message}`);
      throw new HttpException(
        { received: false, message: 'Processing failed' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
