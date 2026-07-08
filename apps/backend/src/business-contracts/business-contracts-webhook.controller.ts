import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { BusinessContractsService } from './business-contracts.service';
import type { BoldSignWebhookPayload } from './business-contracts.types';

@ApiTags('business-contracts')
@Controller('business-contracts')
export class BusinessContractsWebhookController {
  private readonly logger = new Logger(BusinessContractsWebhookController.name);

  constructor(private readonly contractsService: BusinessContractsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BoldSign webhook receiver' })
  async webhook(@Req() req: Request) {
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

    try {
      await this.contractsService.handleWebhookEvent(payload, true);
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
