import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import sharp from 'sharp';
import { AiService } from '../ai/ai.service';
import type { ChatCompletionRequest } from '../ai/chat-completion.types';
import { Configuration } from '../config/configuration';
import type { AiImageCleanupConfidenceTier } from './ai-image-cleanup.types';

export type ConfidenceSignals = {
  similarity: number;
  selfCheck: 'cosmetic_only' | 'minor_ambiguity' | 'altered' | 'error';
  validityPass: boolean;
  validityErrors: string[];
};

export type ConfidenceAssessment = {
  score: number;
  tier: AiImageCleanupConfidenceTier;
  signals: ConfidenceSignals;
  changes: string[];
};

const DEFAULT_HIGH = 0.92;
const DEFAULT_MED = 0.75;

@Injectable()
export class EnhancementConfidenceService {
  private readonly logger = new Logger(EnhancementConfidenceService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async assess(
    originalUrl: string,
    enhancedUrl: string
  ): Promise<ConfidenceAssessment> {
    const [similarity, validity, selfCheck] = await Promise.all([
      this.computeSimilarity(originalUrl, enhancedUrl),
      this.checkValidity(enhancedUrl),
      this.visionSelfCheck(originalUrl, enhancedUrl),
    ]);

    const signals: ConfidenceSignals = {
      similarity: similarity.score,
      selfCheck: selfCheck.verdict,
      validityPass: validity.pass,
      validityErrors: validity.errors,
    };

    const tier = this.computeTier(signals);
    const score = this.compositeScore(signals);
    return {
      score,
      tier,
      signals,
      changes: selfCheck.changes,
    };
  }

  computeTier(signals: ConfidenceSignals): AiImageCleanupConfidenceTier {
    const high = this.threshold('high', DEFAULT_HIGH);
    const med = this.threshold('medium', DEFAULT_MED);
    if (
      !signals.validityPass ||
      signals.selfCheck === 'altered' ||
      signals.selfCheck === 'error' ||
      signals.similarity < med
    ) {
      return 'low';
    }
    if (signals.similarity >= high && signals.selfCheck === 'cosmetic_only') {
      return 'high';
    }
    return 'medium';
  }

  private compositeScore(signals: ConfidenceSignals): number {
    const validity = signals.validityPass ? 1 : 0;
    const self =
      signals.selfCheck === 'cosmetic_only'
        ? 1
        : signals.selfCheck === 'minor_ambiguity'
          ? 0.6
          : 0;
    return Number(
      (signals.similarity * 0.5 + self * 0.35 + validity * 0.15).toFixed(4)
    );
  }

  private threshold(kind: 'high' | 'medium', fallback: number): number {
    const envKey =
      kind === 'high'
        ? 'AI_ENHANCEMENT_SIMILARITY_HIGH'
        : 'AI_ENHANCEMENT_SIMILARITY_MEDIUM';
    const raw = process.env[envKey];
    const parsed = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private async computeSimilarity(
    originalUrl: string,
    enhancedUrl: string
  ): Promise<{ score: number }> {
    try {
      const [a, b] = await Promise.all([
        this.fetchRawRgba(originalUrl),
        this.fetchRawRgba(enhancedUrl),
      ]);
      if (!a || !b || a.length !== b.length) {
        return { score: 0.5 };
      }
      let diff = 0;
      for (let i = 0; i < a.length; i += 4) {
        diff +=
          Math.abs(a[i] - b[i]) +
          Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2]);
      }
      const max = (a.length / 4) * 3 * 255;
      const score = 1 - diff / max;
      return { score: Number(Math.max(0, Math.min(1, score)).toFixed(4)) };
    } catch (error: any) {
      this.logger.warn(`Similarity failed: ${error?.message}`);
      return { score: 0.5 };
    }
  }

  private async fetchRawRgba(url: string): Promise<Buffer | null> {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 25 * 1024 * 1024,
    });
    return sharp(Buffer.from(res.data))
      .resize(256, 256, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer();
  }

  private async checkValidity(
    enhancedUrl: string
  ): Promise<{ pass: boolean; errors: string[] }> {
    const errors: string[] = [];
    try {
      const res = await axios.get<ArrayBuffer>(enhancedUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 25 * 1024 * 1024,
      });
      const meta = await sharp(Buffer.from(res.data)).metadata();
      if (!meta.width || !meta.height) {
        errors.push('missing_dimensions');
      } else if (meta.width < 256 || meta.height < 256) {
        errors.push('resolution_too_low');
      }
      const aspect =
        meta.width && meta.height ? meta.width / meta.height : 1;
      if (aspect < 0.4 || aspect > 2.5) {
        errors.push('aspect_out_of_range');
      }
      if ((meta.size ?? 0) < 1024) {
        errors.push('file_too_small');
      }
    } catch (error: any) {
      errors.push(`fetch_failed:${error?.message ?? 'unknown'}`);
    }
    return { pass: errors.length === 0, errors };
  }

  private async visionSelfCheck(
    originalUrl: string,
    enhancedUrl: string
  ): Promise<{
    verdict: ConfidenceSignals['selfCheck'];
    changes: string[];
  }> {
    try {
      const openai = this.configService.get('openai');
      const model = openai?.chatModel || 'gpt-4o-mini';
      const request: ChatCompletionRequest = {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You compare product photos. Decide if the product itself is identical after AI cleanup. Reply JSON only: {"verdict":"cosmetic_only"|"minor_ambiguity"|"altered","changes":["short phrases"]}. cosmetic_only = lighting/background/crop/sharpen only. altered = product shape, logo, color, or count changed.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Original image, then enhanced image. Is the product identical?',
              },
              { type: 'image_url', image_url: { url: originalUrl, detail: 'low' } },
              { type: 'image_url', image_url: { url: enhancedUrl, detail: 'low' } },
            ],
          },
        ],
      };
      const response = await this.aiService.runOpenAiChatForConfidence(request);
      const content = response.choices?.[0]?.message?.content;
      const raw =
        typeof content === 'string' ? content : JSON.stringify(content ?? {});
      const parsed = JSON.parse(raw || '{}') as {
        verdict?: string;
        changes?: string[];
      };
      const verdict =
        parsed.verdict === 'cosmetic_only' ||
        parsed.verdict === 'minor_ambiguity' ||
        parsed.verdict === 'altered'
          ? parsed.verdict
          : 'minor_ambiguity';
      const changes = Array.isArray(parsed.changes)
        ? parsed.changes.map(String).slice(0, 8)
        : [];
      return { verdict, changes };
    } catch (error: any) {
      this.logger.warn(`Vision self-check failed: ${error?.message}`);
      return { verdict: 'error', changes: [] };
    }
  }
}
