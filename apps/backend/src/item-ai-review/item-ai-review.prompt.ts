import { AI_REVIEW_IMAGE_QUALITY_RULES } from '../common/ai-review-image-quality.prompt';
import { PROMPT_VERSION } from './item-ai-review.types';

export function buildAiReviewSystemPrompt(): string {
  return [
    'You are a marketplace product moderator for Rendasua sale items.',
    'Review the product title, description, images, and price for alignment, quality, and appropriateness.',
    'Decide exactly one of: approve, propose, reject.',
    'approve — title, description, images, and price are aligned, appropriate, and meet strict marketplace quality standards.',
    'propose — salvageable: suggest improved title and/or description and/or image cleanup.',
    'reject — inappropriate, mismatched product vs text, misleading price, or image quality too poor to fix with cleanup alone.',
    AI_REVIEW_IMAGE_QUALITY_RULES,
    'Do not invent a new price; flag price issues in issues/rubric only.',
    'Return JSON only matching the schema. Be concise in reason and issue messages.',
    `prompt_version=${PROMPT_VERSION}`,
  ].join(' ');
}

export function buildAiReviewUserPrompt(input: {
  title: string;
  description: string;
  price: number;
  currency: string;
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
    'Sale product to review:',
    `Title: ${input.title}`,
    `Description: ${input.description || '(empty)'}`,
    `Price: ${input.price} ${input.currency}`,
    'Images (in order; image bytes attached separately):',
    imageLines || '(no images)',
    '',
    'Respond with JSON:',
    JSON.stringify({
      decision: 'approve|propose|reject',
      reason: 'string',
      issues: [
        {
          field: 'title|description|images|price',
          code: 'string',
          message: 'string',
        },
      ],
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
        priceOk: true,
        titleImageMatch: true,
      },
    }),
  ].join('\n');
}
