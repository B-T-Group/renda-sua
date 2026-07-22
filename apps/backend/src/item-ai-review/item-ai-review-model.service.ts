import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  buildAiReviewSystemPrompt,
  buildAiReviewUserPrompt,
} from './item-ai-review.prompt';
import {
  AiReviewModelResult,
  ItemForAiReview,
  ItemImageForReview,
  PROMPT_VERSION,
} from './item-ai-review.types';

@Injectable()
export class ItemAiReviewModelService {
  private static readonly OPENAI_URL =
    'https://api.openai.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async reviewItem(
    item: ItemForAiReview
  ): Promise<{ result: AiReviewModelResult; modelMeta: Record<string, unknown> }> {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const model =
      this.configService.get<string>('itemAiReview.model')?.trim() || 'gpt-4.1';
    const started = Date.now();
    const content = await this.buildMultimodalContent(item);
    const data = await this.callWithRetry(apiKey, model, content);
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty model response');
    const parsed = this.parseResult(JSON.parse(raw));
    return {
      result: parsed,
      modelMeta: {
        provider: 'openai',
        model,
        prompt_version: PROMPT_VERSION,
        latency_ms: Date.now() - started,
        usage: data?.usage ?? null,
      },
    };
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
          ItemAiReviewModelService.OPENAI_URL,
          {
            model,
            messages: [
              { role: 'system', content: buildAiReviewSystemPrompt() },
              { role: 'user', content },
            ],
            max_tokens: 1200,
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
        const status = error?.response?.status;
        const isRateLimit = status === 429;
        const isServerError = status != null && status >= 500;
        if ((isRateLimit || isServerError) && attempt < maxAttempts) {
          const retryAfterSec = parseInt(
            error?.response?.headers?.['retry-after'] ?? '0',
            10
          );
          const backoffMs = retryAfterSec > 0
            ? retryAfterSec * 1000
            : Math.min(2000 * 2 ** (attempt - 1), 30000);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        throw error;
      }
    }
  }

  private async buildMultimodalContent(item: ItemForAiReview) {
    const images = item.item_images ?? [];
    const text = buildAiReviewUserPrompt({
      title: item.name,
      description: item.description ?? '',
      price: item.price,
      currency: item.currency,
      images: images.map((img) => ({
        id: img.id,
        validationErrors: img.validation_errors,
        qualityScore: img.quality_score,
      })),
    });
    const content: Array<{ type: string; text?: string; image_url?: object }> = [
      { type: 'text', text },
    ];
    for (const img of images.slice(0, 6)) {
      const url = await this.toImageUrl(img);
      if (url) {
        content.push({
          type: 'image_url',
          image_url: { url, detail: 'low' },
        });
      }
    }
    return content;
  }

  private async toImageUrl(img: ItemImageForReview): Promise<string | null> {
    const url = img.image_url?.trim();
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return null;
  }

  private parseResult(raw: Record<string, unknown>): AiReviewModelResult {
    const decision = String(raw.decision || '').toLowerCase();
    const allowed = ['approve', 'propose', 'reject'] as const;
    const safeDecision = allowed.includes(decision as (typeof allowed)[number])
      ? (decision as AiReviewModelResult['decision'])
      : 'reject';
    return {
      decision: safeDecision,
      reason: String(raw.reason || 'No reason provided'),
      issues: Array.isArray(raw.issues)
        ? (raw.issues as AiReviewModelResult['issues'])
        : [],
      proposedTitle:
        raw.proposedTitle == null ? null : String(raw.proposedTitle),
      proposedDescription:
        raw.proposedDescription == null
          ? null
          : String(raw.proposedDescription),
      imageActions: Array.isArray(raw.imageActions)
        ? (raw.imageActions as AiReviewModelResult['imageActions'])
        : [],
      alignmentScore:
        typeof raw.alignmentScore === 'number' ? raw.alignmentScore : undefined,
      rubric:
        raw.rubric && typeof raw.rubric === 'object'
          ? (raw.rubric as Record<string, unknown>)
          : undefined,
    };
  }
}
