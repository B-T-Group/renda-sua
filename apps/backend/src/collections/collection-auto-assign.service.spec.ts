import { CollectionAutoAssignService } from './collection-auto-assign.service';

describe('CollectionAutoAssignService', () => {
  const itemId = '11111111-1111-1111-1111-111111111111';
  const collectionA = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    slug: 'vetements',
    name_en: 'Vetements',
    name_fr: 'Vêtements',
  };
  const collectionB = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    slug: 'chaussures',
    name_en: 'Chaussures',
    name_fr: 'Chaussures',
  };

  function createService(overrides?: {
    item?: Record<string, unknown> | null;
    suggestions?: Array<{
      collectionId: string;
      slug: string;
      name_en: string;
      name_fr: string;
      reason?: string;
    }>;
  }) {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({
        insert_item_collections: { affected_rows: 1 },
      }),
    };
    const ai = {
      generateCollectionSuggestions: jest
        .fn()
        .mockResolvedValue(overrides?.suggestions ?? []),
    };

    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ItemForCollectionAutoAssign')) {
        return {
          items_by_pk:
            overrides?.item === undefined
              ? {
                  id: itemId,
                  name: 'Blue suit',
                  description: 'Formal',
                  is_active: true,
                  brand: { name: 'Acme' },
                  item_sub_category: {
                    name: 'Costumes',
                    item_category: { name: 'Vêtements' },
                  },
                  item_images: [],
                  item_collections: [],
                }
              : overrides.item,
        };
      }
      return { collections: [collectionA, collectionB] };
    });

    const service = new CollectionAutoAssignService(hasura as any, ai as any);
    return { service, hasura, ai };
  }

  it('no-ops when item is inactive', async () => {
    const { service, hasura, ai } = createService({
      item: { id: itemId, name: 'x', is_active: false, item_collections: [] },
    });
    await expect(service.autoAssignCollectionsIfFit(itemId)).resolves.toEqual(
      []
    );
    expect(ai.generateCollectionSuggestions).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('no-ops when already has max collections', async () => {
    const { service, ai, hasura } = createService({
      item: {
        id: itemId,
        name: 'x',
        is_active: true,
        item_collections: [
          { collection_id: collectionA.id },
          { collection_id: collectionB.id },
        ],
      },
    });
    await expect(service.autoAssignCollectionsIfFit(itemId)).resolves.toEqual(
      []
    );
    expect(ai.generateCollectionSuggestions).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('no-ops when suggestions are empty', async () => {
    const { service, hasura } = createService({ suggestions: [] });
    await expect(service.autoAssignCollectionsIfFit(itemId)).resolves.toEqual(
      []
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('inserts only missing suggestions up to max 2', async () => {
    const { service, hasura, ai } = createService({
      item: {
        id: itemId,
        name: 'Blue suit',
        is_active: true,
        item_collections: [{ collection_id: collectionA.id }],
        item_sub_category: {
          name: 'Costumes',
          item_category: { name: 'Vêtements' },
        },
        item_images: [],
      },
      suggestions: [
        { ...collectionA, collectionId: collectionA.id },
        { ...collectionB, collectionId: collectionB.id },
      ],
    });

    await expect(service.autoAssignCollectionsIfFit(itemId)).resolves.toEqual([
      collectionB.id,
    ]);
    expect(ai.generateCollectionSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        strictFitOnly: true,
        maxSuggestions: 2,
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertAutoItemCollections'),
      {
        objects: [{ item_id: itemId, collection_id: collectionB.id }],
      }
    );
  });

  it('swallows AI failures', async () => {
    const { service, ai, hasura } = createService();
    ai.generateCollectionSuggestions.mockRejectedValue(new Error('bedrock down'));
    await expect(service.autoAssignCollectionsIfFit(itemId)).resolves.toEqual(
      []
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});
