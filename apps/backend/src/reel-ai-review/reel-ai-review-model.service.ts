import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockLunaService } from '../ai/bedrock-luna.service';
import {
  REEL_AI_REVIEW_SYSTEM_PROMPT,
} from './reel-ai-review.prompt';

export interface ReelReviewInput {
  caption?: string | null;
  subject_type: string;
  subject_id?: string;
  market_country: string;
  thumbnail_url?: string | null;
  processing_status?: string | null;
  product_name?: string | null;
  product_image_urls?: string[];
}

export interface ReelReviewDecision {
  approve: boolean;
  reason: string;
  raw: unknown;
  model: string;
  showsProduct: boolean;
  policyClean: boolean;
  issues: string[];
}

@Injectable()
export class ReelAiReviewModelService {
  constructor(
    private readonly config: ConfigService,
    private readonly bedrock: BedrockLunaService
  ) {}

  async review(reel: ReelReviewInput): Promise<ReelReviewDecision> {
    const model = this.bedrock.resolveModel(
      this.config.get<string>('reelAiReview.model')
    );
    const result = await this.bedrock.complete({
      model,
      messages: [
        { role: 'system', content: REEL_AI_REVIEW_SYSTEM_PROMPT },
        { role: 'user', content: this.content(reel) },
      ],
      maxTokens: 400,
      temperature: 0,
      jsonObject: true,
      reasoningEffort: 'low',
      timeoutMs: 60000,
    });
    return this.parseDecision(result.text, result.model);
  }

  private parseDecision(text: string, model: string): ReelReviewDecision {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const showsProduct = parsed.shows_product === true;
    const policyClean = parsed.policy_clean === true;
    const decisionApprove = parsed.decision === 'approve';
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map((i) => String(i))
      : [];
    return {
      approve: decisionApprove && showsProduct && policyClean,
      reason: String(parsed.reason || 'Manual review required'),
      raw: parsed,
      model,
      showsProduct,
      policyClean,
      issues,
    };
  }

  private content(reel: ReelReviewInput) {
    const productLine = reel.product_name
      ? `\nProduct: ${reel.product_name}`
      : '';
    const content: Array<{ type: string; text?: string; image_url?: object }> = [
      {
        type: 'text',
        text: `Subject: ${reel.subject_type}\nMarket: ${reel.market_country}${productLine}\nCaption: ${reel.caption || ''}`,
      },
    ];
    const images = [
      ...(reel.thumbnail_url ? [reel.thumbnail_url] : []),
      ...(reel.product_image_urls ?? []).slice(0, 3),
    ];
    for (const url of images) {
      content.push({
        type: 'image_url',
        image_url: { url, detail: 'auto' },
      });
    }
    return content;
  }
}
