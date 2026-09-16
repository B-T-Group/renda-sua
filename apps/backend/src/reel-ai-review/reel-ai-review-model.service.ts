import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockLunaService } from '../ai/bedrock-luna.service';

export interface ReelReviewInput {
  caption?: string | null;
  subject_type: string;
  market_country: string;
  thumbnail_url?: string | null;
}

@Injectable()
export class ReelAiReviewModelService {
  constructor(
    private readonly config: ConfigService,
    private readonly bedrock: BedrockLunaService
  ) {}

  async review(reel: ReelReviewInput) {
    const model = this.bedrock.resolveModel(
      this.config.get<string>('reelAiReview.model')
    );
    const result = await this.bedrock.complete({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Review commerce reel content for safety and subject alignment. Return JSON {"decision":"approve"|"manual_review","reason":"..."}. Never reject automatically.',
        },
        { role: 'user', content: this.content(reel) },
      ],
      maxTokens: 300,
      temperature: 0,
      jsonObject: true,
      reasoningEffort: 'low',
      timeoutMs: 60000,
    });
    const parsed = JSON.parse(result.text) as Record<string, unknown>;
    return {
      approve: parsed.decision === 'approve',
      reason: String(parsed.reason || 'Manual review required'),
      raw: parsed,
      model: result.model,
    };
  }

  private content(reel: ReelReviewInput) {
    const content: Array<{ type: string; text?: string; image_url?: object }> = [
      {
        type: 'text',
        text: `Subject: ${reel.subject_type}\nMarket: ${reel.market_country}\nCaption: ${reel.caption || ''}`,
      },
    ];
    if (reel.thumbnail_url) {
      content.push({
        type: 'image_url',
        image_url: { url: reel.thumbnail_url, detail: 'auto' },
      });
    }
    return content;
  }
}
