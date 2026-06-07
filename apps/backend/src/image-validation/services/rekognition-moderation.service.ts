import {
  DetectModerationLabelsCommand,
  RekognitionClient,
} from '@aws-sdk/client-rekognition';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../config/configuration';
import type {
  ImageModerationResult,
  ValidatedImage,
} from '../types/image-validation.types';

const BLOCKED_PARENTS = new Set([
  'Explicit',
  'Violence',
  'Visually Disturbing',
  'Hate Symbols',
  'Drugs',
]);

@Injectable()
export class RekognitionModerationService {
  private readonly logger = new Logger(RekognitionModerationService.name);
  private readonly client: RekognitionClient;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const aws = this.configService.get('aws', { infer: true });
    this.client = new RekognitionClient({
      region: aws?.region || 'ca-central-1',
      credentials: {
        accessKeyId: aws?.accessKeyId || '',
        secretAccessKey: aws?.secretAccessKey || '',
      },
    });
  }

  async analyzeBatch(images: ValidatedImage[]): Promise<ImageModerationResult[]> {
    const minConfidence =
      this.configService.get('imageValidation', { infer: true })
        ?.rekognitionMinConfidence ?? 80;

    const results = await Promise.all(
      images.map((image) => this.analyzeOne(image, minConfidence))
    );
    return results;
  }

  private async analyzeOne(
    image: ValidatedImage,
    minConfidence: number
  ): Promise<ImageModerationResult> {
    try {
      const response = await this.client.send(
        new DetectModerationLabelsCommand({
          Image: { Bytes: image.buffer },
          MinConfidence: minConfidence,
        })
      );
      const flagged = (response.ModerationLabels ?? []).filter((label) =>
        this.isBlockedLabel(label.Name, label.ParentName, label.Confidence)
      );
      return {
        clientIndex: image.clientIndex,
        safe: flagged.length === 0,
        categories: flagged.map(
          (l) => l.ParentName || l.Name || 'inappropriate'
        ),
      };
    } catch (error: any) {
      this.logger.warn(
        `Rekognition moderation failed for image ${image.clientIndex}: ${
          error.message ?? 'unknown'
        }`
      );
      return { clientIndex: image.clientIndex, safe: true, categories: [] };
    }
  }

  private isBlockedLabel(
    name?: string,
    parentName?: string,
    confidence?: number
  ): boolean {
    if (!confidence || confidence < 0) return false;
    const parent = parentName?.trim();
    if (parent && BLOCKED_PARENTS.has(parent)) return true;
    const label = name?.trim();
    if (!label) return false;
    return [...BLOCKED_PARENTS].some((blocked) => label.includes(blocked));
  }
}
