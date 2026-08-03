/** Shared image-quality rules injected into item and rental AI review prompts. */
export const AI_REVIEW_IMAGE_QUALITY_RULES = [
  'Apply marketplace image quality standards.',
  'Never approve when any image is below 600×600 pixels, visibly pixelated, blurry, or otherwise unusable.',
  'Between 600×600 and 800×800, prefer propose (ask for a better photo) over reject when the product is otherwise clear.',
  'Never reject an image marked already_cleaned=true for resolution alone — AI cleanup outputs 1024×1024.',
  'Never approve when background clutter, poor focus, or poor lighting makes the product hard to see — unless already_cleaned=true and the enhanced photo looks marketplace-ready.',
  'Use propose (with cleanup imageActions) only when background clutter might be fixed with AI photo cleanup and the image is not already_cleaned.',
  'Use reject when resolution is below 600×600 or the photo cannot be salvaged with cleanup alone.',
  'Treat validation_warnings for IMAGE_BLURRY as strong reject signals. Treat LOW_RESOLUTION as propose unless dimensions are below 600×600.',
  'Set rubric.imagesOk=false whenever image quality is not marketplace-ready.',
].join(' ');
