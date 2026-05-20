import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ItemEmbeddingService } from './item-embedding.service';

class SyncItemEmbeddingsDto {
  itemId!: string;
  name?: string;
  description?: string;
}

/** Hasura event trigger / internal jobs: refresh item embeddings after GraphQL mutations. */
@ApiExcludeController()
@Controller('internal/items/embeddings')
export class ItemEmbeddingInternalController {
  constructor(
    private readonly configService: ConfigService,
    private readonly itemEmbeddingService: ItemEmbeddingService
  ) {}

  @Public()
  @Post('sync')
  async syncFromWebhook(
    @Headers('x-internal-api-key') apiKey: string | undefined,
    @Body() body: SyncItemEmbeddingsDto | { event?: { data?: { new?: Record<string, unknown> } } }
  ): Promise<{ ok: boolean }> {
    this.assertInternalKey(apiKey);
    const payload = this.resolvePayload(body);
    if (!payload.itemId || !payload.name) {
      throw new HttpException(
        'itemId and name are required',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.itemEmbeddingService.syncItemEmbeddings(
      payload.itemId,
      { name: payload.name, description: payload.description ?? '' },
      { force: true }
    );
    return { ok: true };
  }

  private assertInternalKey(provided: string | undefined): void {
    const expected =
      this.configService.get<string>('notificationsInternal.apiKey') ?? '';
    if (!expected || provided !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }

  private resolvePayload(body: unknown): SyncItemEmbeddingsDto {
    const direct = body as SyncItemEmbeddingsDto;
    if (direct?.itemId && direct?.name) {
      return direct;
    }
    const webhook = body as {
      event?: { data?: { new?: Record<string, unknown> } };
    };
    const row = webhook.event?.data?.new;
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') {
      throw new HttpException('Invalid webhook payload', HttpStatus.BAD_REQUEST);
    }
    return {
      itemId: row.id,
      name: row.name,
      description:
        typeof row.description === 'string' ? row.description : '',
    };
  }
}
