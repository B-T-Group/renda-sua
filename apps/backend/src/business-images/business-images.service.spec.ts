import {
  BusinessImage,
  BusinessImagesService,
} from './business-images.service';

jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class ItemAiReviewService {},
}));

describe('BusinessImagesService mutations', () => {
  const businessId = 'business-1';
  const imageId = 'image-1';
  let hasuraUserService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let service: BusinessImagesService;

  beforeEach(() => {
    hasuraUserService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    service = new BusinessImagesService(
      hasuraUserService as never,
      hasuraSystemService as never,
      { resubmitIfRejected: jest.fn() } as never
    );
  });

  it('creates image rows through the system mutation client', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_item_images: { returning: [{ id: imageId }] },
    });

    const result = await service.bulkCreateBusinessImages(businessId, 12, [
      { image_url: 'https://example.com/item.jpg' },
    ]);

    expect(result).toEqual([{ id: imageId }]);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_item_images'),
      {
        objects: [
          expect.objectContaining({
            business_id: businessId,
            item_sub_category_id: 12,
            image_type: 'main',
          }),
        ],
      }
    );
    expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
  });

  it('updates an owned image through the system mutation client', async () => {
    const image = createImage();
    hasuraSystemService.executeQuery.mockResolvedValue({
      item_images: [image],
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_item_images_by_pk: { ...image, caption: 'Updated caption' },
    });

    const result = await service.updateBusinessImage(businessId, imageId, {
      caption: 'Updated caption',
    });

    expect(result.caption).toBe('Updated caption');
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('update_item_images_by_pk'),
      { id: imageId, changes: { caption: 'Updated caption' } }
    );
    expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
  });

  it('deletes an owned image through the system mutation client', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      item_images: [createImage()],
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      delete_item_images_by_pk: { id: imageId },
    });

    await service.deleteBusinessImage(businessId, imageId);

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('delete_item_images_by_pk'),
      { id: imageId }
    );
    expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
  });

  function createImage(): BusinessImage {
    return {
      id: imageId,
      business_id: businessId,
      item_id: null,
      item_sub_category_id: null,
      image_url: 'https://example.com/item.jpg',
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
      created_at: '2026-07-16T00:00:00.000Z',
    };
  }
});
