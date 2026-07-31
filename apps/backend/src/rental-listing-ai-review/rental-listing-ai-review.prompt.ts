import { AI_REVIEW_IMAGE_QUALITY_RULES } from '../common/ai-review-image-quality.prompt';
import { PROMPT_VERSION } from './rental-listing-ai-review.types';

export function buildAiReviewSystemPrompt(): string {
  return [
    'You are a rental marketplace listing moderator for Rendasua.',
    'Review the listing title, description, and images for alignment, quality, and appropriateness.',
    'Decide exactly one of: approve, propose, reject.',
    'approve — title, description, and images are aligned, appropriate, and meet strict marketplace quality standards.',
    'propose — salvageable: suggest improved title and/or description and/or image cleanup.',
    'reject — inappropriate, mismatched product vs text, or image quality too poor to fix with cleanup alone.',
    AI_REVIEW_IMAGE_QUALITY_RULES,
    'Return JSON only matching the schema. Be concise in reason and issue messages.',
    `prompt_version=${PROMPT_VERSION}`,
  ].join(' ');
}

export function buildAiReviewUserPrompt(input: {
  title: string;
  description: string;
  images: Array<{
    id: string;
    width?: number | null;
    height?: number | null;
    validationErrors?: unknown;
    validationWarnings?: unknown;
    qualityScore?: number | null;
  }>;
}): string {
  const imageLines = input.images
    .map((img, i) => {
      const errs = img.validationErrors
        ? JSON.stringify(img.validationErrors)
        : '[]';
      const warnings = img.validationWarnings
        ? JSON.stringify(img.validationWarnings)
        : '[]';
      const dims =
        img.width && img.height ? `${img.width}x${img.height}` : 'unknown';
      return `Image ${i + 1} id=${img.id} dimensions=${dims} quality=${img.qualityScore ?? 'n/a'} validation_errors=${errs} validation_warnings=${warnings}`;
    })
    .join('\n');
  return [
    'Listing to review:',
    `Title: ${input.title}`,
    `Description: ${input.description || '(empty)'}`,
    'Images (in order; image bytes attached separately):',
    imageLines || '(no images)',
    '',
    'Respond with JSON:',
    JSON.stringify({
      decision: 'approve|propose|reject',
      reason: 'string',
      issues: [{ field: 'title|description|images', code: 'string', message: 'string' }],
      proposedTitle: 'string|null',
      proposedDescription: 'string|null',
      imageActions: [
        { imageId: 'uuid', action: 'keep|cleanup|replace_required', note: 'string' },
      ],
      alignmentScore: 0.0,
      rubric: {
        titleOk: true,
        descriptionOk: true,
        imagesOk: true,
        titleImageMatch: true,
      },
    }),
  ].join('\n');
}
