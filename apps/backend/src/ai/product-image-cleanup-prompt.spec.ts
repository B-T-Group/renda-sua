import { buildProductImageCleanupPrompt } from './product-image-cleanup-prompt';

describe('buildProductImageCleanupPrompt', () => {
  it('requires preserving wear and limits scope to background/lighting', () => {
    const prompt = buildProductImageCleanupPrompt();
    expect(prompt).toContain('Only clean the background and improve lighting');
    expect(prompt).toContain('scratches');
    expect(prompt).toContain('Do not invent, remove, fill in, or smooth');
    expect(prompt).toContain('used-item wear');
  });

  it('adds issue-specific hints without relaxing product fidelity', () => {
    const prompt = buildProductImageCleanupPrompt([
      { code: 'IMAGE_BLURRY' },
      { code: 'CLUTTERED_BACKGROUND' },
    ]);
    expect(prompt).toContain('including wear and scratches');
    expect(prompt).toContain('Do not touch or retouch the product itself');
  });
});
