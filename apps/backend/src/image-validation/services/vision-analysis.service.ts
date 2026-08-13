import { Injectable, Logger } from '@nestjs/common';
import { BedrockLunaService } from '../../ai/bedrock-luna.service';
import type {
  ValidatedImage,
  VisionImageAnalysis,
} from '../types/image-validation.types';

interface VisionBatchResult {
  images: Array<{
    index: number;
    safe: boolean;
    moderationCategories: string[];
    productFillPercent: number;
    backgroundClutter: 'low' | 'medium' | 'high';
    promotionalTextLevel: 'none' | 'low' | 'high';
  }>;
}

@Injectable()
export class VisionAnalysisService {
  private readonly logger = new Logger(VisionAnalysisService.name);

  constructor(private readonly bedrockLunaService: BedrockLunaService) {}

  async analyzeBatch(
    images: ValidatedImage[],
    timeoutMs: number,
    options?: { includeModeration?: boolean }
  ): Promise<VisionImageAnalysis[]> {
    const includeModeration = options?.includeModeration ?? true;
    if (!images.length) return [];

    const content: Array<{ type: string; text?: string; image_url?: object }> =
      [
        {
          type: 'text',
          text: this.buildPrompt(images.length, includeModeration),
        },
      ];

    for (const img of images) {
      const b64 = img.buffer.toString('base64');
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${b64}`,
          detail: 'low',
        },
      });
    }

    try {
      const model = this.bedrockLunaService.getDefaultChatModel();
      const result = await this.bedrockLunaService.complete({
        model,
        messages: [{ role: 'user', content }],
        maxTokens: 800,
        temperature: 0,
        jsonObject: true,
        reasoningEffort: 'none',
        timeoutMs,
      });
      const parsed = JSON.parse(result.text) as VisionBatchResult;
      return this.mapResults(parsed, images.length, includeModeration);
    } catch (error: any) {
      this.logger.warn(
        `Bedrock vision analysis failed: ${error?.message ?? 'unknown'}`
      );
      return [];
    }
  }

  private buildPrompt(count: number, includeModeration: boolean): string {
    return `Analyze ${count} product photo(s). Return JSON only:
{"images":[{"index":0,"safe":true,"moderationCategories":[],"productFillPercent":60,"backgroundClutter":"low","promotionalTextLevel":"none"}]}
Rules: index is 0-based. productFillPercent 0-100. backgroundClutter low|medium|high. promotionalTextLevel none|low|high.
${includeModeration ? 'Set safe=false and list moderationCategories when content is adult/violent/hate.' : 'Ignore moderation; always safe=true and empty categories.'}`;
  }

  private mapResults(
    parsed: VisionBatchResult,
    expected: number,
    includeModeration: boolean
  ): VisionImageAnalysis[] {
    const byIndex = new Map(
      (parsed.images ?? []).map((img) => [img.index, img])
    );
    const out: VisionImageAnalysis[] = [];
    for (let i = 0; i < expected; i++) {
      const row = byIndex.get(i);
      out.push({
        clientIndex: i,
        // When moderation is required, missing/undefined safe must not default to safe.
        safe: includeModeration ? row?.safe === true : true,
        moderationCategories: row?.moderationCategories ?? [],
        productFillPercent: row?.productFillPercent ?? 50,
        backgroundClutter: row?.backgroundClutter ?? 'medium',
        promotionalTextLevel: row?.promotionalTextLevel ?? 'none',
      });
    }
    return out;
  }
}
