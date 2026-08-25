jest.mock('../business-images/business-images.service', () => ({
  BusinessImagesService: class BusinessImagesService {},
}));
jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class ItemAiReviewService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));
jest.mock('../ai/ai.service', () => ({
  AiService: class AiService {},
}));

import { HttpException } from '@nestjs/common';
import { BusinessItemsService } from './business-items.service';

describe('BusinessItemsService createItemFromImage / quickPublish', () => {
  const businessId = 'business-1';
  const itemId = 'item-1';
  const imageId = 'image-1';
  const locationId = 'location-1';

  const createService = () => {
    const hasuraUserService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const hasuraSystemService = {
      resolveBusinessCurrency: jest.fn().mockResolvedValue('XAF'),
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const businessImagesService = {
      getImageForBusiness: jest.fn(),
      linkLibraryImageToNewItem: jest.fn().mockResolvedValue(undefined),
    };
    const aiService = {
      generateImageItemSuggestions: jest.fn(),
    };
    const itemsService = {
      createItem: jest.fn(),
      updateItem: jest.fn(),
    };
    const itemAiReviewService = {
      requestReview: jest.fn(),
      resubmitIfRejected: jest.fn(),
    };
    const paymentRoutingService = {
      resolveRailForBusiness: jest.fn().mockResolvedValue('stripe'),
    };
    const merchantLifecycleService = { recompute: jest.fn() };

    const service = new BusinessItemsService(
      hasuraUserService as any,
      hasuraSystemService as any,
      businessImagesService as any,
      aiService as any,
      itemsService as any,
      itemAiReviewService as any,
      paymentRoutingService as any,
      merchantLifecycleService as any,
      {} as any,
      {} as any
    );

    return {
      service,
      hasuraUserService,
      hasuraSystemService,
      businessImagesService,
      aiService,
      itemsService,
      itemAiReviewService,
    };
  };

  describe('createItemFromImage', () => {
    it('falls back to Other/Other subcategory for eager drafts without category', async () => {
      const {
        service,
        businessImagesService,
        hasuraSystemService,
        itemsService,
      } = createService();

      businessImagesService.getImageForBusiness.mockResolvedValue({
        id: imageId,
        image_url: 'https://cdn.example/img.jpg',
        caption: null,
        alt_text: null,
        item_id: null,
      });
      hasuraSystemService.executeQuery.mockImplementation((query: string) => {
        if (query.includes('CheckItemSkus')) {
          return Promise.resolve({ items: [] });
        }
        if (query.includes('FindCategoryAndSubcategory')) {
          return Promise.resolve({
            item_sub_categories: [{ id: 99, item_category_id: 7 }],
          });
        }
        return Promise.resolve({});
      });
      itemsService.createItem.mockResolvedValue({
        id: itemId,
        name: 'Untitled product',
        sku: 'UNTITLED-PRO',
      });

      const result = await service.createItemFromImage(businessId, {
        imageId,
        description: 'Ready for review',
      });

      expect(result).toEqual({
        id: itemId,
        name: 'Untitled product',
        sku: 'UNTITLED-PRO',
      });
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('FindCategoryAndSubcategory'),
        { categoryName: 'Other', subCategoryName: 'Other' }
      );
      expect(itemsService.createItem).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          name: 'Untitled product',
          item_sub_category_id: 99,
          currency: 'XAF',
          is_active: false,
        })
      );
      expect(itemsService.createItem.mock.calls[0][1]).not.toHaveProperty(
        'price'
      );
      expect(
        businessImagesService.linkLibraryImageToNewItem
      ).toHaveBeenCalledWith(businessId, imageId, itemId);
    });

    it('persists shopper-facing dimensions on insert', async () => {
      const {
        service,
        businessImagesService,
        hasuraSystemService,
        itemsService,
      } = createService();

      businessImagesService.getImageForBusiness.mockResolvedValue({
        id: imageId,
        image_url: 'https://cdn.example/img.jpg',
        caption: null,
        alt_text: null,
        item_id: null,
      });
      hasuraSystemService.executeQuery.mockImplementation((query: string) => {
        if (query.includes('CheckItemSkus')) {
          return Promise.resolve({ items: [] });
        }
        if (query.includes('FindCategoryAndSubcategory')) {
          return Promise.resolve({
            item_sub_categories: [{ id: 99, item_category_id: 7 }],
          });
        }
        return Promise.resolve({});
      });
      itemsService.createItem.mockResolvedValue({
        id: itemId,
        name: 'Eau de parfum',
        sku: 'EAU-DE-PARF',
      });

      await service.createItemFromImage(businessId, {
        imageId,
        name: 'Eau de parfum',
        description: 'Ready for review',
        dimensions: '  50ml  ',
      });

      expect(itemsService.createItem).toHaveBeenCalledWith(
        businessId,
        expect.objectContaining({
          name: 'Eau de parfum',
          dimensions: '50ml',
        })
      );
    });

    it('resumes an existing draft linked to the image without creating another item', async () => {
      const {
        service,
        businessImagesService,
        hasuraSystemService,
        itemsService,
      } = createService();

      businessImagesService.getImageForBusiness.mockResolvedValue({
        id: imageId,
        image_url: 'https://cdn.example/img.jpg',
        caption: null,
        alt_text: null,
        item_id: itemId,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        items_by_pk: {
          id: itemId,
          name: 'Draft shoes',
          sku: 'DRAFT-SHOES',
          business_id: businessId,
          moderation_status: 'draft',
        },
      });

      const result = await service.createItemFromImage(businessId, {
        imageId,
        name: 'Ignored',
      });

      expect(result).toEqual({
        id: itemId,
        name: 'Draft shoes',
        sku: 'DRAFT-SHOES',
        moderation_status: 'draft',
      });
      expect(itemsService.createItem).not.toHaveBeenCalled();
      expect(
        businessImagesService.linkLibraryImageToNewItem
      ).not.toHaveBeenCalled();
    });

    it('returns an already-submitted linked item so quick-publish can complete idempotently', async () => {
      const {
        service,
        businessImagesService,
        hasuraSystemService,
        itemsService,
      } = createService();

      businessImagesService.getImageForBusiness.mockResolvedValue({
        id: imageId,
        image_url: 'https://cdn.example/img.jpg',
        caption: null,
        alt_text: null,
        item_id: itemId,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        items_by_pk: {
          id: itemId,
          name: 'Submitted shoes',
          sku: 'SUB-SHOES',
          business_id: businessId,
          moderation_status: 'pending',
        },
      });

      const result = await service.createItemFromImage(businessId, {
        imageId,
      });

      expect(result).toEqual({
        id: itemId,
        name: 'Submitted shoes',
        sku: 'SUB-SHOES',
        moderation_status: 'pending',
      });
      expect(itemsService.createItem).not.toHaveBeenCalled();
    });

    it('rejects an image linked to an item owned by another business', async () => {
      const { service, businessImagesService, hasuraSystemService } =
        createService();

      businessImagesService.getImageForBusiness.mockResolvedValue({
        id: imageId,
        image_url: 'https://cdn.example/img.jpg',
        caption: null,
        alt_text: null,
        item_id: itemId,
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        items_by_pk: {
          id: itemId,
          name: 'Other biz item',
          sku: 'OTHER',
          business_id: 'business-other',
          moderation_status: 'draft',
        },
      });

      try {
        await service.createItemFromImage(businessId, { imageId });
        fail('expected HttpException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          error: 'Image is already linked to an item',
        });
      }
    });
  });

  describe('publishBusinessItem / quickPublishBusinessItem', () => {
    it('treats already-submitted moderation statuses as successful publish', async () => {
      const { service, hasuraSystemService, itemAiReviewService } =
        createService();

      hasuraSystemService.executeQuery.mockResolvedValue({
        items_by_pk: {
          id: itemId,
          business_id: businessId,
          moderation_status: 'pending',
          name: 'Shoes',
          description: null,
          status: 'active',
          price: 1500,
        },
      });

      await expect(
        service.publishBusinessItem(businessId, itemId)
      ).resolves.toEqual({
        id: itemId,
        moderation_status: 'pending',
      });
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
      expect(itemAiReviewService.requestReview).not.toHaveBeenCalled();
    });

    it('rejects quick-publish when price is missing', async () => {
      const { service, hasuraSystemService } = createService();

      hasuraSystemService.executeQuery.mockResolvedValue({
        items_by_pk: {
          id: itemId,
          business_id: businessId,
          price: null,
          moderation_status: 'draft',
        },
      });

      try {
        await service.quickPublishBusinessItem(businessId, itemId, {
          locationId,
        });
        fail('expected HttpException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(400);
        expect(error.getResponse()).toMatchObject({
          error: 'PRICE_REQUIRED',
        });
      }
    });

    it('quick-publishes already-submitted items without re-mutating moderation', async () => {
      const {
        service,
        hasuraSystemService,
        hasuraUserService,
        itemAiReviewService,
      } = createService();

      hasuraSystemService.executeQuery.mockImplementation((query: string) => {
        if (query.includes('GetItemById') || query.includes('items_by_pk')) {
          return Promise.resolve({
            items_by_pk: {
              id: itemId,
              business_id: businessId,
              price: 2500,
              moderation_status: 'ai_reviewing',
              name: 'Shoes',
              description: null,
              status: 'active',
            },
          });
        }
        return Promise.resolve({});
      });
      hasuraUserService.executeQuery.mockImplementation((query: string) => {
        if (query.includes('FindInventory')) {
          return Promise.resolve({
            business_inventory: [{ id: 'inv-1' }],
          });
        }
        if (query.includes('GetInventoryWithBusiness')) {
          return Promise.resolve({
            business_inventory_by_pk: {
              id: 'inv-1',
              business_location: { business_id: businessId },
            },
          });
        }
        return Promise.resolve({});
      });
      hasuraUserService.executeMutation.mockResolvedValue({
        update_business_inventory_by_pk: { id: 'inv-1' },
      });

      const result = await service.quickPublishBusinessItem(
        businessId,
        itemId,
        { locationId, quantity: 3, sellingPrice: 2500 }
      );

      expect(result).toEqual({
        item: { id: itemId, moderation_status: 'ai_reviewing' },
        inventory: { id: 'inv-1' },
      });
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
      expect(itemAiReviewService.requestReview).not.toHaveBeenCalled();
    });

    it('rejects quick-publish for non-draft statuses that are not submitted', async () => {
      const { service, hasuraSystemService } = createService();

      hasuraSystemService.executeQuery.mockResolvedValue({
        items_by_pk: {
          id: itemId,
          business_id: businessId,
          price: 1000,
          moderation_status: 'rejected',
        },
      });

      await expect(
        service.quickPublishBusinessItem(businessId, itemId, { locationId })
      ).rejects.toBeInstanceOf(HttpException);
    });
  });
});
