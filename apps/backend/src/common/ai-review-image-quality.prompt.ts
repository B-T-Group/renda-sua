/** Shared image-quality rules injected into item and rental AI review prompts. */
export const AI_REVIEW_IMAGE_QUALITY_RULES = [
  'Apply strict image quality standards. Never approve when any image:',
  '- Is below 800×800 pixels, visibly pixelated, blurry, or otherwise low resolution.',
  '- Has a cluttered, noisy, or distracting background that hurts product visibility.',
  '- Makes the product hard to see because of background clutter, poor focus, or poor lighting.',
  'Use propose (with cleanup imageActions) only when background clutter might be fixed with AI photo cleanup and resolution is otherwise acceptable.',
  'Use reject when resolution is too low or the photo cannot be salvaged with cleanup alone.',
  'Treat validation_warnings for LOW_RESOLUTION or CLUTTERED_BACKGROUND as strong signals — do not override them with approve.',
  'Set rubric.imagesOk=false whenever image quality is not marketplace-ready.',
].join(' ');
