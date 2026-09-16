import {
  REEL_AI_REVIEW_PROMPT_VERSION,
  REEL_AI_REVIEW_SYSTEM_PROMPT,
} from './reel-ai-review.prompt';

describe('reel-ai-review.prompt', () => {
  it('exports v2 prompt version and never-auto-reject guidance', () => {
    expect(REEL_AI_REVIEW_PROMPT_VERSION).toBe('reel-ai-review-v2');
    expect(REEL_AI_REVIEW_SYSTEM_PROMPT).toContain('Never reject automatically');
    expect(REEL_AI_REVIEW_SYSTEM_PROMPT).toContain('shows_product');
    expect(REEL_AI_REVIEW_SYSTEM_PROMPT).toContain('policy_clean');
  });
});
