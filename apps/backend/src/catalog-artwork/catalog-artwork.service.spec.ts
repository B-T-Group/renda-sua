import { CatalogArtworkService } from './catalog-artwork.service';

describe('CatalogArtworkService', () => {
  const aiService = { generateCatalogArtwork: jest.fn() };
  const awsService = { getDefaultBucketName: jest.fn(), getS3Client: jest.fn() };
  const configService = { get: jest.fn() };
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };

  let service: CatalogArtworkService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogArtworkService(
      aiService as any,
      awsService as any,
      configService as any,
      hasura as any
    );
  });

  it('fails open when image generation throws', async () => {
    hasura.executeQuery.mockResolvedValue({
      item_categories_by_pk: {
        id: 4,
        name: 'Shoes',
        description: null,
        image_url: null,
      },
    });
    aiService.generateCatalogArtwork.mockRejectedValue(new Error('openai down'));

    expect(() => service.scheduleCategoryArtwork(4)).not.toThrow();
    await flushPromises();

    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('skips generation when artwork already exists', async () => {
    hasura.executeQuery.mockResolvedValue({
      collections_by_pk: {
        id: 'col-1',
        name_en: 'Essentials',
        description_en: null,
        image_url: 'https://cdn.example/cover.jpg',
      },
    });

    await service.ensureCollectionArtwork('col-1');

    expect(aiService.generateCatalogArtwork).not.toHaveBeenCalled();
  });
});

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
