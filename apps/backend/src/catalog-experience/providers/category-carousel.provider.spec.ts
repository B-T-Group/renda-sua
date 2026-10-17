import { Test, TestingModule } from '@nestjs/testing';
import { CategoryCarouselProvider } from './category-carousel.provider';
import { HasuraSystemService } from '../../hasura/hasura-system.service';

describe('CategoryCarouselProvider', () => {
  let provider: CategoryCarouselProvider;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryCarouselProvider,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<CategoryCarouselProvider>(CategoryCarouselProvider);
    hasuraSystemService = module.get(HasuraSystemService);
  });

  describe('F-M7: category counts include only approved items', () => {
    it('should filter items_aggregate by moderation_status approved', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        item_categories: [
          {
            id: 1,
            name: 'Electronics',
            image_url: 'electronics.jpg',
            item_sub_categories: [
              { items_aggregate: { aggregate: { count: 10 } } },
            ],
          },
        ],
      });

      const context = {
        country: 'TG',
        state: null,
        language: 'en',
        layout: 'discovery' as const,
        isReturning: false,
        userId: null,
      };

      await provider.build(context);

      const query = hasuraSystemService.executeQuery.mock.calls[0][0];
      expect(query).toContain('moderation_status: { _eq: "approved" }');
    });
  });
});
