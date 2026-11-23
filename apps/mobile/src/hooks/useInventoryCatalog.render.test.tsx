import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useInventoryCatalog } from './useInventoryCatalog';

jest.mock('../services/inventoryItemsApi', () => ({
  fetchPublicInventoryItems: jest.fn(),
  fetchAuthenticatedInventoryItems: jest.fn(),
}));

import {
  fetchPublicInventoryItems,
} from '../services/inventoryItemsApi';

const fetchPublic = jest.mocked(fetchPublicInventoryItems);

function pageEnvelope(
  items: { id: string }[],
  total = items.length,
  matchedStores?: { id: string }[]
) {
  return {
    success: true as const,
    message: 'ok',
    data: {
      items,
      total,
      page: 1,
      limit: 25,
      totalPages: Math.max(1, Math.ceil(total / 25)),
      ...(matchedStores ? { matched_stores: matchedStores } : {}),
    },
  };
}

const dish = {
  id: 'dish-1',
  item: {
    item_sub_category: {
      item_category: { name: ' Restaurant & Cooked Food ' },
    },
  },
};
const kettle = {
  id: 'kettle-1',
  item: { item_sub_category: { item_category: { name: 'Électroménager' } } },
};

describe('useInventoryCatalog export_only clearing', () => {
  beforeEach(() => {
    fetchPublic.mockReset();
  });

  it('clears items and shows loading as soon as export_only turns on', async () => {
    let resolveExport: ((value: unknown) => void) | undefined;
    fetchPublic
      .mockResolvedValueOnce(
        pageEnvelope([{ id: 'local-1' }, { id: 'local-2' }], 2) as never
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          })
      );

    const { result, rerender } = await renderHook(
      ({ export_only }: { export_only?: boolean }) =>
        useInventoryCatalog({
          search: '',
          sort: 'relevance',
          countryCode: 'CM',
          export_only,
          enabled: true,
        }),
      { initialProps: { export_only: undefined } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual([
      'local-1',
      'local-2',
    ]);

    await act(async () => {
      rerender({ export_only: true });
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveExport?.(pageEnvelope([{ id: 'export-1' }], 1));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['export-1']);
  });

  it('clears export items as soon as export_only turns off', async () => {
    let resolveLocal: ((value: unknown) => void) | undefined;
    fetchPublic
      .mockResolvedValueOnce(
        pageEnvelope([{ id: 'export-1' }], 40, [{ id: 'store-1' }]) as never
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLocal = resolve;
          })
      );

    const { result, rerender } = await renderHook(
      ({ export_only }: { export_only?: boolean }) =>
        useInventoryCatalog({
          search: '',
          sort: 'relevance',
          countryCode: 'CM',
          export_only,
          enabled: true,
        }),
      { initialProps: { export_only: true as boolean | undefined } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(40);
    expect(result.current.matchedStores).toEqual([{ id: 'store-1' }]);

    await act(async () => {
      rerender({ export_only: undefined });
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.matchedStores).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.page).toBe(1);

    await act(async () => {
      resolveLocal?.(pageEnvelope([{ id: 'local-1' }], 1));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['local-1']);
  });

  it('does not load another page after the export request fails', async () => {
    fetchPublic
      .mockResolvedValueOnce(pageEnvelope([{ id: 'local-1' }], 50) as never)
      .mockRejectedValueOnce(new Error('export down'));

    const { result, rerender } = await renderHook(
      ({ export_only }: { export_only?: boolean }) =>
        useInventoryCatalog({
          search: '',
          sort: 'relevance',
          countryCode: 'CM',
          export_only,
          enabled: true,
        }),
      { initialProps: { export_only: undefined as boolean | undefined } }
    );

    await waitFor(() => expect(result.current.totalPages).toBe(2));
    await act(async () => {
      rerender({ export_only: true });
    });
    await waitFor(() => expect(result.current.error).toBe('export down'));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.page).toBe(1);
    expect(fetchPublic).toHaveBeenLastCalledWith(
      expect.objectContaining({ export_only: true, page: 1, limit: 25 }),
      expect.anything()
    );
    const calls = fetchPublic.mock.calls.length;
    await act(async () => {
      result.current.loadMore();
    });
    expect(fetchPublic).toHaveBeenCalledTimes(calls);
  });

  it('stops paging when a food request still includes other goods', async () => {
    fetchPublic.mockResolvedValue(
      pageEnvelope([dish, kettle], 400) as never
    );

    const { result } = await renderHook(() =>
      useInventoryCatalog({
        search: '',
        sort: 'relevance',
        countryCode: 'CM',
        food_only: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['dish-1']);
    expect(result.current.total).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(fetchPublic).toHaveBeenCalledWith(
      expect.objectContaining({ food_only: true, page: 1, limit: 25 }),
      expect.anything()
    );
    await act(async () => {
      result.current.loadMore();
    });
    expect(fetchPublic).toHaveBeenCalledTimes(1);
  });

  it('keeps paging a food catalog when every row is cooked food', async () => {
    fetchPublic.mockResolvedValue(pageEnvelope([dish], 50) as never);

    const { result } = await renderHook(() =>
      useInventoryCatalog({
        search: '',
        sort: 'relevance',
        food_only: true,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(50);
    expect(result.current.totalPages).toBe(2);
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(fetchPublic).toHaveBeenCalledTimes(2));
    expect(fetchPublic).toHaveBeenLastCalledWith(
      expect.objectContaining({ food_only: true, page: 2, limit: 25 }),
      expect.anything()
    );
  });
});
