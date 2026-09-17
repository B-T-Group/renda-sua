import { ReelAiReviewModelService } from './reel-ai-review-model.service';
import { REEL_AI_REVIEW_SYSTEM_PROMPT } from './reel-ai-review.prompt';

describe('ReelAiReviewModelService', () => {
  const bedrock = {
    resolveModel: jest.fn().mockReturnValue('luna-v1'),
    complete: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue('luna') };

  let service: ReelAiReviewModelService;

  beforeEach(() => {
    jest.clearAllMocks();
    bedrock.resolveModel.mockReturnValue('luna-v1');
    service = new ReelAiReviewModelService(config as never, bedrock as never);
  });

  function completeWith(payload: Record<string, unknown>) {
    bedrock.complete.mockResolvedValueOnce({
      text: JSON.stringify(payload),
      model: 'luna-v1',
    });
  }

  const reel = {
    caption: 'Handmade soap',
    subject_type: 'item',
    subject_id: 'item-1',
    market_country: 'CM',
    thumbnail_url: 'https://cdn/thumb.jpg',
    product_name: 'Shea soap',
    product_image_urls: [
      'https://cdn/p1.jpg',
      'https://cdn/p2.jpg',
      'https://cdn/p3.jpg',
      'https://cdn/p4.jpg',
    ],
  };

  it('approves only when decision, product, and policy all pass', async () => {
    completeWith({
      decision: 'approve',
      shows_product: true,
      policy_clean: true,
      reason: 'Clear product shot',
      issues: [],
    });

    await expect(service.review(reel)).resolves.toEqual({
      approve: true,
      reason: 'Clear product shot',
      raw: expect.objectContaining({ decision: 'approve' }),
      model: 'luna-v1',
      showsProduct: true,
      policyClean: true,
      issues: [],
    });
  });

  it('withholds approval when the model says approve but the product is not shown', async () => {
    completeWith({
      decision: 'approve',
      shows_product: false,
      policy_clean: true,
      reason: 'Lifestyle only',
    });

    const decision = await service.review(reel);

    expect(decision.approve).toBe(false);
    expect(decision.showsProduct).toBe(false);
    expect(decision.policyClean).toBe(true);
  });

  it('withholds approval when policy_clean is not strictly true', async () => {
    completeWith({
      decision: 'approve',
      shows_product: true,
      policy_clean: 'true',
      reason: 'Looks fine',
    });

    const decision = await service.review(reel);

    expect(decision.approve).toBe(false);
    expect(decision.policyClean).toBe(false);
  });

  it('defaults the reason and coerces issues when the model omits them', async () => {
    completeWith({
      decision: 'manual_review',
      shows_product: true,
      policy_clean: true,
      issues: [1, 'blurry'],
    });

    const decision = await service.review(reel);

    expect(decision.approve).toBe(false);
    expect(decision.reason).toBe('Manual review required');
    expect(decision.issues).toEqual(['1', 'blurry']);
  });

  it('sends the system prompt plus thumbnail and at most three product images', async () => {
    completeWith({
      decision: 'manual_review',
      shows_product: true,
      policy_clean: true,
      reason: 'Unsure',
    });

    await service.review(reel);

    expect(bedrock.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'luna-v1',
        jsonObject: true,
        messages: [
          { role: 'system', content: REEL_AI_REVIEW_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: expect.stringContaining('Product: Shea soap'),
              },
              {
                type: 'image_url',
                image_url: { url: 'https://cdn/thumb.jpg', detail: 'auto' },
              },
              {
                type: 'image_url',
                image_url: { url: 'https://cdn/p1.jpg', detail: 'auto' },
              },
              {
                type: 'image_url',
                image_url: { url: 'https://cdn/p2.jpg', detail: 'auto' },
              },
              {
                type: 'image_url',
                image_url: { url: 'https://cdn/p3.jpg', detail: 'auto' },
              },
            ],
          },
        ],
      })
    );
    const userContent = bedrock.complete.mock.calls[0][0].messages[1].content;
    expect(userContent).toHaveLength(5);
    expect(JSON.stringify(userContent)).not.toContain('p4.jpg');
  });
});
