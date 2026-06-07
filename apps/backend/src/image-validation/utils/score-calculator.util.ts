import type { ValidationIssue } from '../types/image-validation.types';
import { VALIDATION_CODES } from '../types/image-validation.types';

const DEDUCTIONS: Record<string, number> = {
  [VALIDATION_CODES.LOW_RESOLUTION]: 50,
  [VALIDATION_CODES.IMAGE_BLURRY]: 40,
  [VALIDATION_CODES.INAPPROPRIATE_CONTENT]: 100,
  [VALIDATION_CODES.POOR_LIGHTING]: 15,
  [VALIDATION_CODES.PRODUCT_TOO_SMALL]: 20,
  [VALIDATION_CODES.CLUTTERED_BACKGROUND]: 10,
  [VALIDATION_CODES.TOO_MUCH_TEXT]: 10,
  [VALIDATION_CODES.DUPLICATE_IMAGE]: 5,
};

export function calculateScore(issues: ValidationIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= DEDUCTIONS[issue.code] ?? 5;
  }
  return Math.max(0, Math.min(100, score));
}

export function aggregateScore(results: { score: number }[]): number {
  if (!results.length) return 0;
  const total = results.reduce((acc, r) => acc + r.score, 0);
  return Math.round(total / results.length);
}
