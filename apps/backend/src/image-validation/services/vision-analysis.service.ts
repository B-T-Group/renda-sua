import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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
  private static readonly OPENAI_URL =
    'https://api.openai.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async analyzeBatch(
    images: ValidatedImage[],
    timeoutMs: number,
    options?: { includeModeration?: boolean }
  ): Promise<VisionImageAnalysis[]> {
    const includeModeration = options?.includeModeration ?? true;
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey || !images.length) return [];

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
      const model =
        this.configService.get<string>('openai.chatModel')?.trim() ||
        'gpt-4o-mini';
      const { data } = await axios.post(
        VisionAnalysisService.OPENAI_URL,
        {
          model,
          messages: [{ role: 'user', content }],
          max_tokens: 800,
          temperature: 0,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
        }
      );

      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) return [];
      const parsed = JSON.parse(raw) as VisionBatchResult;
      return (parsed.images ?? []).map((r) => ({
        clientIndex: r.index,
        safe: r.safe,
        moderationCategories: r.moderationCategories ?? [],
        productFillPercent: r.productFillPercent ?? 50,
        backgroundClutter: r.backgroundClutter ?? 'low',
        promotionalTextLevel: r.promotionalTextLevel ?? 'none',
      }));
    } catch (error: any) {
      this.logger.warn(
        `Vision analysis failed or timed out: ${error.message ?? 'unknown'}`
      );
      return [];
    }
  }

  private buildPrompt(count: number, includeModeration: boolean): string {
    const moderationRules = includeModeration
      ? `- safe=false if nudity, violence, hate symbols, illegal products, or clearly inappropriate content
- moderationCategories: list violated categories when safe=false`
      : `- safe: always true
- moderationCategories: always []`;

    return `You are a marketplace product image reviewer. Analyze ${count} product image(s) in order (index 0 to ${
      count - 1
    }). Return JSON only:
{
  "images": [
    {
      "index": 0,
      "safe": true,
      "moderationCategories": [],
      "productFillPercent": 70,
      "backgroundClutter": "low",
      "promotionalTextLevel": "none"
    }
  ]
}
Rules:
${moderationRules}
- productFillPercent: estimated % of frame occupied by main product (0-100)
- backgroundClutter: low|medium|high
- promotionalTextLevel: none|low|high (large promotional overlays)`;
  }
}
