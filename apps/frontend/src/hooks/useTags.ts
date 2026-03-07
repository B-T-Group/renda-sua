import { useCallback, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface Tag {
  id: string;
  name: string;
}

const GET_TAGS = `
  query GetTags {
    tags(order_by: { name: asc }) {
      id
      name
    }
  }
`;

const INSERT_TAG = `
  mutation InsertTag($name: String!) {
    insert_tags_one(object: { name: $name }) {
      id
      name
    }
  }
`;

const INSERT_ITEM_TAGS = `
  mutation InsertItemTags($objects: [item_tags_insert_input!]!) {
    insert_item_tags(objects: $objects) {
      affected_rows
    }
  }
`;

const DELETE_ALL_ITEM_TAGS_FOR_ITEM = `
  mutation DeleteAllItemTagsForItem($itemId: uuid!) {
    delete_item_tags(where: { item_id: { _eq: $itemId } }) {
      affected_rows
    }
  }
`;

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute: executeGetTags } = useGraphQLRequest<{ tags: Tag[] }>(
    GET_TAGS,
    { showLoading: false }
  );
  const { execute: executeInsertTag } =
    useGraphQLRequest<{ insert_tags_one: Tag }>(INSERT_TAG, {
      showLoading: false,
    });
  const { execute: executeInsertItemTags } =
    useGraphQLRequest<{ insert_item_tags: { affected_rows: number } }>(
      INSERT_ITEM_TAGS,
      { showLoading: false }
    );
  const { execute: executeDeleteAllItemTags } = useGraphQLRequest(
    DELETE_ALL_ITEM_TAGS_FOR_ITEM,
    { showLoading: false }
  );

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await executeGetTags();
      setTags(result?.tags ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch tags'
      );
    } finally {
      setLoading(false);
    }
  }, [executeGetTags]);

  const createTag = useCallback(
    async (name: string): Promise<Tag | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      try {
        const result = await executeInsertTag({ name: trimmed });
        const newTag = result?.insert_tags_one;
        if (newTag) {
          setTags((prev) =>
            [...prev, newTag].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
          );
          return newTag;
        }
        return null;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to create tag'
        );
        throw err;
      }
    },
    [executeInsertTag]
  );

  const setItemTags = useCallback(
    async (itemId: string, tagIds: string[]): Promise<void> => {
      await executeDeleteAllItemTags({ itemId });
      if (tagIds.length > 0) {
        await executeInsertItemTags({
          objects: tagIds.map((tag_id) => ({ item_id: itemId, tag_id })),
        });
      }
    },
    [executeDeleteAllItemTags, executeInsertItemTags]
  );

  return {
    tags,
    loading,
    error,
    fetchTags,
    createTag,
    setItemTags,
  };
}
