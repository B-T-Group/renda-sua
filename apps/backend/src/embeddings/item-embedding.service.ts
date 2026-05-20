import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import {
  isSkuLikeQuery,
  normalizeSearchQuery,
  toPgVectorLiteral,
} from './item-embedding.util';

export interface ItemEmbeddingRow {
  name_embedding: number[] | null;
  description_embedding: number[] | null;
}

export interface ItemSimilarityMatch {
  item_id: string;
  similarity: number;
}

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

interface QueryCacheEntry {
  vector: number[];
  expiresAt: number;
}

@Injectable()
export class ItemEmbeddingService {
  private readonly logger = new Logger(ItemEmbeddingService.name);
  private static readonly OPENAI_EMBEDDINGS_URL =
    'https://api.openai.com/v1/embeddings';

  private readonly queryCache = new Map<string, QueryCacheEntry>();

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService
  ) {}

  async embedSearchQuery(q: string): Promise<number[]> {
    const normalized = normalizeSearchQuery(q);
    if (normalized.length < 2) {
      throw new HttpException(
        'Search query too short',
        HttpStatus.BAD_REQUEST
      );
    }
    const cached = this.getCachedQueryVector(normalized);
    if (cached) return cached;
    const [vector] = await this.embedTexts([normalized]);
    this.setCachedQueryVector(normalized, vector);
    return vector;
  }

  async buildEmbeddingsForItem(input: {
    name: string;
    description?: string | null;
  }): Promise<ItemEmbeddingRow> {
    const nameText = (input.name ?? '').trim();
    if (!nameText) {
      throw new Error('Item name is required for embeddings');
    }
    const descText = (input.description ?? '').trim();
    const texts = descText ? [nameText, descText] : [nameText];
    const vectors = await this.embedTexts(texts);
    return {
      name_embedding: vectors[0],
      description_embedding: descText ? vectors[1] : null,
    };
  }

  async persistItemEmbeddings(
    itemId: string,
    row: ItemEmbeddingRow
  ): Promise<void> {
    const nameLit = toPgVectorLiteral(row.name_embedding ?? []);
    if (row.description_embedding?.length) {
      const descLit = toPgVectorLiteral(row.description_embedding);
      await this.databaseService.query(
        `UPDATE public.items
         SET name_embedding = $1::vector,
             description_embedding = $2::vector
         WHERE id = $3::uuid`,
        [nameLit, descLit, itemId]
      );
      return;
    }
    await this.databaseService.query(
      `UPDATE public.items
       SET name_embedding = $1::vector,
           description_embedding = NULL
       WHERE id = $2::uuid`,
      [nameLit, itemId]
    );
  }

  async getItemEmbeddingState(itemId: string): Promise<{
    name: string;
    description: string;
    hasNameEmbedding: boolean;
    hasDescriptionEmbedding: boolean;
  } | null> {
    const rows = await this.databaseService.query<{
      name: string;
      description: string;
      has_name: boolean;
      has_desc: boolean;
    }>(
      `SELECT name, description,
              (name_embedding IS NOT NULL) AS has_name,
              (description_embedding IS NOT NULL) AS has_desc
       FROM public.items WHERE id = $1::uuid`,
      [itemId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      name: row.name,
      description: row.description ?? '',
      hasNameEmbedding: row.has_name,
      hasDescriptionEmbedding: row.has_desc,
    };
  }

  async syncItemEmbeddings(
    itemId: string,
    input: { name: string; description?: string | null },
    options?: {
      previousName?: string;
      previousDescription?: string;
      force?: boolean;
    }
  ): Promise<void> {
    const name = (input.name ?? '').trim();
    const description = (input.description ?? '').trim();
    const prevName = (options?.previousName ?? '').trim();
    const prevDesc = (options?.previousDescription ?? '').trim();

    if (!options?.force) {
      const state = await this.getItemEmbeddingState(itemId);
      if (!state) return;
      const nameChanged = name !== prevName;
      const descChanged = description !== prevDesc;
      const missing =
        !state.hasNameEmbedding ||
        (description.length > 0 && !state.hasDescriptionEmbedding);
      if (!missing && !nameChanged && !descChanged) return;
    }

    const row = await this.buildEmbeddingsForItem({ name, description });
    await this.persistItemEmbeddings(itemId, row);
  }

  async findSimilarItemIds(
    queryVector: number[],
    minSimilarity: number,
    limit: number
  ): Promise<ItemSimilarityMatch[]> {
    const vec = toPgVectorLiteral(queryVector);
    return this.databaseService.query<ItemSimilarityMatch>(
      `SELECT i.id AS item_id,
              GREATEST(
                CASE WHEN i.name_embedding IS NOT NULL
                  THEN 1 - (i.name_embedding <=> $1::vector) ELSE 0 END,
                CASE WHEN i.description_embedding IS NOT NULL
                  THEN 1 - (i.description_embedding <=> $1::vector) ELSE 0 END
              ) AS similarity
       FROM public.items i
       WHERE i.status IS DISTINCT FROM 'deleted'
         AND (
           (i.name_embedding IS NOT NULL
             AND 1 - (i.name_embedding <=> $1::vector) >= $2)
           OR (i.description_embedding IS NOT NULL
             AND 1 - (i.description_embedding <=> $1::vector) >= $2)
         )
       ORDER BY similarity DESC
       LIMIT $3`,
      [vec, minSimilarity, limit]
    );
  }

  async findItemIdsByExactSku(sku: string): Promise<string[]> {
    const rows = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM public.items
       WHERE status IS DISTINCT FROM 'deleted'
         AND lower(trim(sku)) = lower(trim($1))`,
      [sku]
    );
    return rows.map((r) => r.id);
  }

  getMinSimilarity(): number {
    return (
      this.configService.get<number>('inventorySearch.minSimilarity') ?? 0.38
    );
  }

  getMatchLimit(): number {
    return (
      this.configService.get<number>('inventorySearch.matchLimit') ?? 500
    );
  }

  isSkuLikeQuery(q: string): boolean {
    return isSkuLikeQuery(q);
  }

  normalizeSearchQuery(q: string): string {
    return normalizeSearchQuery(q);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (inputs.length === 0) return [];
    const apiKey = this.requireOpenAiApiKey();
    const model = this.getEmbeddingModel();
    const response = await axios.post<OpenAiEmbeddingsResponse>(
      ItemEmbeddingService.OPENAI_EMBEDDINGS_URL,
      { model, input: inputs },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    const sorted = [...(response.data?.data ?? [])].sort(
      (a, b) => a.index - b.index
    );
    return sorted.map((d) => d.embedding);
  }

  private getCachedQueryVector(key: string): number[] | null {
    const entry = this.queryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.queryCache.delete(key);
      return null;
    }
    return entry.vector;
  }

  private setCachedQueryVector(key: string, vector: number[]): void {
    const ttl =
      this.configService.get<number>('inventorySearch.queryCacheTtlMs') ??
      300000;
    this.queryCache.set(key, { vector, expiresAt: Date.now() + ttl });
  }

  private requireOpenAiApiKey(): string {
    const key = this.configService.get<string>('openai.apiKey')?.trim();
    if (!key) {
      this.logger.error('OPENAI_API_KEY not configured');
      throw new HttpException(
        'OpenAI API key not configured',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    return key;
  }

  private getEmbeddingModel(): string {
    return (
      this.configService.get<string>('openai.embeddingModel')?.trim() ||
      'text-embedding-3-small'
    );
  }
}
