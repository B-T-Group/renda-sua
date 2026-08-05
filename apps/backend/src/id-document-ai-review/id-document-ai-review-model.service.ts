import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  buildIdDocumentSystemPrompt,
  buildIdDocumentUserPrompt,
} from './id-document-ai-review.prompt';
import {
  ID_DOCUMENT_PROMPT_VERSION,
  IdDocumentModelResult,
} from './id-document-ai-review.types';

@Injectable()
export class IdDocumentAiReviewModelService {
  private static readonly OPENAI_URL =
    'https://api.openai.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async reviewIdDocument(params: {
    imageUrl: string;
    expectedName: string;
    alternateNames: string[];
    documentType: string;
  }): Promise<{
    result: IdDocumentModelResult;
    modelMeta: Record<string, unknown>;
  }> {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) throw new Error('OpenAI API key not configured');
    const model =
      this.configService.get<string>('idDocumentAiReview.model')?.trim() ||
      'gpt-4.1';
    const started = Date.now();
    const content = this.buildContent(params);
    const data = await this.callWithRetry(apiKey, model, content);
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty model response');
    return {
      result: this.parseResult(JSON.parse(raw)),
      modelMeta: {
        provider: 'openai',
        model,
        prompt_version: ID_DOCUMENT_PROMPT_VERSION,
        latency_ms: Date.now() - started,
        usage: data?.usage ?? null,
      },
    };
  }

  private buildContent(params: {
    imageUrl: string;
    expectedName: string;
    alternateNames: string[];
    documentType: string;
  }) {
    return [
      {
        type: 'text',
        text: buildIdDocumentUserPrompt({
          expectedName: params.expectedName,
          alternateNames: params.alternateNames,
          documentType: params.documentType,
        }),
      },
      {
        type: 'image_url',
        image_url: { url: params.imageUrl, detail: 'high' },
      },
    ];
  }

  private async callWithRetry(
    apiKey: string,
    model: string,
    content: Array<{ type: string; text?: string; image_url?: object }>,
    maxAttempts = 4
  ): Promise<any> {
    let attempt = 0;
    while (true) {
      try {
        const { data } = await axios.post(
          IdDocumentAiReviewModelService.OPENAI_URL,
          {
            model,
            messages: [
              { role: 'system', content: buildIdDocumentSystemPrompt() },
              { role: 'user', content },
            ],
            max_tokens: 600,
            temperature: 0,
            response_format: { type: 'json_object' },
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 90000,
          }
        );
        return data;
      } catch (error: any) {
        attempt++;
        if (!this.shouldRetry(error, attempt, maxAttempts)) throw error;
        await this.sleep(this.backoffMs(error, attempt));
      }
    }
  }

  private shouldRetry(
    error: any,
    attempt: number,
    maxAttempts: number
  ): boolean {
    if (attempt >= maxAttempts) return false;
    const status = error?.response?.status;
    return status === 429 || (status != null && status >= 500);
  }

  private backoffMs(error: any, attempt: number): number {
    const retryAfterSec = parseInt(
      error?.response?.headers?.['retry-after'] ?? '0',
      10
    );
    if (retryAfterSec > 0) return retryAfterSec * 1000;
    return Math.min(2000 * 2 ** (attempt - 1), 30000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  parseResult(raw: Record<string, unknown>): IdDocumentModelResult {
    const confidence =
      typeof raw.confidence === 'number'
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0;
    return {
      isIdDocument: raw.isIdDocument === true,
      extractedName:
        raw.extractedName == null || raw.extractedName === ''
          ? null
          : String(raw.extractedName),
      nameMatches: raw.nameMatches === true,
      confidence,
      reasons: Array.isArray(raw.reasons)
        ? raw.reasons.map((r) => String(r))
        : [],
    };
  }
}
