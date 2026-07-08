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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { BoldsignWebhookVerifierService } from './boldsign-webhook-verifier.service';
import { BusinessContractsService } from './business-contracts.service';
import type { BoldSignWebhookPayload } from './business-contracts.types';

@ApiTags('business-contracts')
@Controller('business-contracts')
export class BusinessContractsWebhookController {
  private readonly logger = new Logger(BusinessContractsWebhookController.name);

  constructor(
    private readonly verifier: BoldsignWebhookVerifierService,
    private readonly contractsService: BusinessContractsService
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BoldSign webhook receiver' })
  async webhook(
    @Headers('x-boldsign-signature') signature: string,
    @Req() req: Request
  ) {
    const rawBody = (req as unknown as { body: Buffer }).body;
    const valid = this.verifier.verify(signature, rawBody);
    if (!valid) {
      this.logger.warn('BoldSign webhook signature verification failed');
      throw new HttpException(
        { received: false, message: 'Invalid signature' },
        HttpStatus.BAD_REQUEST
      );
    }

    let payload: BoldSignWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as BoldSignWebhookPayload;
    } catch (error: any) {
      throw new HttpException(
        { received: false, message: 'Invalid JSON' },
        HttpStatus.BAD_REQUEST
      );
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
