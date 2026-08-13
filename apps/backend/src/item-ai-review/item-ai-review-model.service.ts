import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockLunaService } from '../ai/bedrock-luna.service';
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
  constructor(
    private readonly configService: ConfigService,
    private readonly bedrockLunaService: BedrockLunaService
  ) {}

  async reviewItem(
    item: ItemForAiReview,
    opts?: { cleanupAlreadyQueued?: boolean }
  ): Promise<{ result: AiReviewModelResult; modelMeta: Record<string, unknown> }> {
    const model = this.bedrockLunaService.resolveModel(
      this.configService.get<string>('itemAiReview.model')
    );
    const started = Date.now();
    const content = await this.buildMultimodalContent(item, opts);
    const result = await this.bedrockLunaService.complete({
      model,
      messages: [
        { role: 'system', content: buildAiReviewSystemPrompt() },
        { role: 'user', content },
      ],
      maxTokens: 1200,
      temperature: 0,
      jsonObject: true,
      reasoningEffort: 'low',
      timeoutMs: 90000,
    });
    const parsed = this.parseResult(JSON.parse(result.text));
    return {
      result: parsed,
      modelMeta: {
        provider: 'bedrock',
        model: result.model,
        prompt_version: PROMPT_VERSION,
        latency_ms: Date.now() - started,
        usage: result.usage,
      },
    };
  }

  private async buildMultimodalContent(
    item: ItemForAiReview,
    opts?: { cleanupAlreadyQueued?: boolean }
  ) {
    const images = item.item_images ?? [];
    const text = buildAiReviewUserPrompt({
      title: item.name,
      description: item.description ?? '',
      price: item.price,
      currency: item.currency,
      cleanupAlreadyQueued: !!opts?.cleanupAlreadyQueued,
      images: images.map((img) => ({
        id: img.id,
        width: img.width,
        height: img.height,
        validationErrors: img.validation_errors,
        validationWarnings: img.validation_warnings,
        qualityScore: img.quality_score,
        alreadyCleaned: !!img.is_ai_cleaned,
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
          image_url: { url, detail: 'auto' },
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
