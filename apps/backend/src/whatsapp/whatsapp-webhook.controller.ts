import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import type { Configuration, WhatsAppConfig } from '../config/configuration';

@ApiTags('whatsapp')
@Controller('whatsapp')
@SkipThrottle()
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService<Configuration>
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
  @ApiOperation({ summary: 'Meta WhatsApp webhook event receiver (stub)' })
  @ApiResponse({ status: 200, description: 'Event acknowledged' })
  handleWebhook(@Body() body: unknown): { received: true } {
    this.logger.log(
      `WhatsApp webhook received (stub): ${JSON.stringify(body)}`
    );
    return { received: true };
  }

  private isValidSubscription(
    mode: string | undefined,
    verifyToken: string | undefined
  ): boolean {
    const expected = this.getVerifyToken();
    return (
      mode === 'subscribe' && !!expected && verifyToken === expected
    );
  }

  private getVerifyToken(): string {
    return (
      this.configService.get<WhatsAppConfig>('whatsapp')?.webhookVerifyToken ??
      ''
    );
  }
}
