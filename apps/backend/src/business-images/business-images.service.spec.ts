jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class {},
}));

import { BusinessImagesService, type BusinessImage } from './business-images.service';

describe('BusinessImagesService privileged field filtering', () => {
  const image: BusinessImage = {
    id: 'image-1',
    business_id: 'business-1',
    item_id: null,
    item_sub_category_id: null,
    image_url: 'https://example.com/image.jpg',
    s3_key: null,
    file_size: null,
    width: null,
    height: null,
    format: null,
    caption: null,
    alt_text: null,
    tags: [],
    status: 'unassigned',
    is_ai_cleaned: false,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('drops ownership and association fields from generic image updates', async () => {
    const hasuraSystem = {
      executeQuery: jest.fn().mockResolvedValue({ item_images: [image] }),
      executeMutation: jest.fn().mockResolvedValue({
        update_item_images_by_pk: { ...image, caption: 'Updated caption' },
      }),
    };
    const service = new BusinessImagesService(
      {} as any,
      hasuraSystem as any,
      {} as any
    );

    await service.updateBusinessImage('business-1', 'image-1', {
      caption: 'Updated caption',
      business_id: 'victim-business',
      item_id: 'victim-item',
      display_order: 999,
    } as any);

    expect(hasuraSystem.executeMutation.mock.calls[0][1].changes).toEqual({
      caption: 'Updated caption',
    });
  });
});
