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

function pageEnvelope(items: { id: string }[], total = items.length) {
  return {
    success: true as const,
    message: 'ok',
    data: {
      items,
      total,
      page: 1,
      limit: 25,
      totalPages: Math.max(1, Math.ceil(total / 25)),
    },
  };
}

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
});
