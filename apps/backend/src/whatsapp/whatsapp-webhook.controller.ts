import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import type { Configuration, WhatsAppConfig } from '../config/configuration';
import { WhatsAppInboundService } from '../notifications/orchestration/whatsapp-inbound.service';

@ApiTags('whatsapp')
@Controller('whatsapp')
@SkipThrottle()
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly inboundService: WhatsAppInboundService
  ) {}

  @Public()
  @Get('webhook')
  @ApiOperation({ summary: 'Meta WhatsApp webhook verification handshake' })
  @ApiQuery({ name: 'hub.mode', required: true })
  @ApiQuery({ name: 'hub.verify_token', required: true })
  @ApiQuery({ name: 'hub.challenge', required: true })
  @ApiResponse({ status: 200, description: 'Returns hub.challenge as plain text' })
  @ApiResponse({ status: 403, description: 'Invalid verify token or mode' })
  verifyWebhook(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') verifyToken: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res({ passthrough: false }) res: Response
  ): void {
    if (!this.isValidSubscription(mode, verifyToken) || !challenge) {
      throw new ForbiddenException('Webhook verification failed');
    }
    this.logger.log('WhatsApp webhook verified');
    res.status(HttpStatus.OK).type('text/plain').send(challenge);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Meta WhatsApp webhook event receiver (status + STOP/commands)',
  })
  @ApiHeader({
    name: 'x-hub-signature-256',
    required: false,
    description: 'HMAC SHA-256 of raw body using WHATSAPP_APP_SECRET',
  })
  @ApiResponse({ status: 200, description: 'Event acknowledged' })
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined
  ): Promise<{ received: true }> {
    const rawBody = (req as unknown as { body: Buffer | unknown }).body;
    if (!Buffer.isBuffer(rawBody)) {
      throw new HttpException(
        { received: false, message: 'Expected raw body' },
        HttpStatus.BAD_REQUEST
      );
    }
    this.inboundService.assertValidSignature(rawBody, signature);
    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch (error: any) {
      throw new HttpException(
        { received: false, message: 'Invalid JSON' },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.inboundService.handleWebhookBody(body);
  }

  private isValidSubscription(
    mode: string | undefined,
    verifyToken: string | undefined
  ): boolean {
    const expected = this.getVerifyToken();
    return mode === 'subscribe' && !!expected && verifyToken === expected;
  }

  private getVerifyToken(): string {
    return (
      this.configService.get<WhatsAppConfig>('whatsapp')?.webhookVerifyToken ??
      ''
    );
  }
}
