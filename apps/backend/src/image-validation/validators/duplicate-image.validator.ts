import { Injectable } from '@nestjs/common';
import { DuplicateImageDetectorService } from '../services/duplicate-image-detector.service';
import type {
  ImageValidator,
  ValidationContext,
  ValidationIssue,
  ValidatedImage,
} from '../types/image-validation.types';
import { VALIDATION_CODES } from '../types/image-validation.types';
import { validationMessage } from '../utils/validation-messages.util';

@Injectable()
export class DuplicateImageValidator implements ImageValidator {
  readonly name = 'duplicate-image';
  private readonly batchHashes = new Map<number, string>();

  constructor(private readonly duplicateDetector: DuplicateImageDetectorService) {}

  setBatchHash(clientIndex: number, hash: string): void {
    this.batchHashes.set(clientIndex, hash);
  }

  clearBatch(): void {
    this.batchHashes.clear();
  }

  async validate(
    image: ValidatedImage,
    ctx: ValidationContext
  ): Promise<ValidationIssue[]> {
    const hash = await this.duplicateDetector.computeHash(image);
    this.setBatchHash(image.clientIndex, hash);

    const existing = [...ctx.existingPhashes];
    for (const [idx, h] of this.batchHashes) {
      if (idx < image.clientIndex) existing.push(h);
    }

    if (!this.duplicateDetector.isDuplicate(hash, existing)) return [];
    return [
      {
        code: VALIDATION_CODES.DUPLICATE_IMAGE,
        message: validationMessage(VALIDATION_CODES.DUPLICATE_IMAGE),
        severity: 'warning',
      },
    ];
  }
}
