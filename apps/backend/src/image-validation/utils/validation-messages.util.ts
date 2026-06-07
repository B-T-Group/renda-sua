import { VALIDATION_CODES } from '../types/image-validation.types';

const MESSAGES: Record<string, string> = {
  [VALIDATION_CODES.LOW_RESOLUTION]:
    'The image resolution is too low. Use at least 800×800 pixels.',
  [VALIDATION_CODES.IMAGE_BLURRY]:
    'The image is blurry. Please upload a sharper photo.',
  [VALIDATION_CODES.INAPPROPRIATE_CONTENT]:
    'This image cannot be used because it contains inappropriate content.',
  [VALIDATION_CODES.POOR_LIGHTING]:
    'The image is too dark or overexposed. Better lighting may improve buyer confidence.',
  [VALIDATION_CODES.PRODUCT_TOO_SMALL]:
    'The product appears too small in the image. Try moving closer.',
  [VALIDATION_CODES.CLUTTERED_BACKGROUND]:
    'The background contains distracting objects. Consider using a cleaner background.',
  [VALIDATION_CODES.TOO_MUCH_TEXT]:
    'The image contains a lot of promotional text. A cleaner product photo works better.',
  [VALIDATION_CODES.DUPLICATE_IMAGE]:
    'This image looks very similar to another photo you already uploaded.',
};

export function validationMessage(code: string): string {
  return MESSAGES[code] ?? 'This image does not meet marketplace guidelines.';
}
