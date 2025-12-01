import { renderHook, act } from '@testing-library/react';
import * as OrdersHook from './useOrders';
import * as BackendOrdersHook from './useBackendOrders';
import { useBatchOrderActions } from './useBatchOrderActions';

describe('useBatchOrderActions', () => {
  it('calls backend batch API and refreshes orders', async () => {
    const refreshOrders = jest.fn().mockResolvedValue(undefined);
    const startPreparingBatch = jest.fn().mockResolvedValue({
      success: true,
      results: [],
    });

    jest
      .spyOn(OrdersHook, 'useOrders')
      .mockReturnValue({ orders: [], loading: false, error: null, fetchOrders: jest.fn(), refreshOrders } as any);

    jest
      .spyOn(BackendOrdersHook, 'useBackendOrders')
      .mockReturnValue({ startPreparingBatch } as any);

    const { result } = renderHook(() => useBatchOrderActions());

    await act(async () => {
      await result.current.batchStartPreparing(['order-1'], 'notes');
    });

    expect(startPreparingBatch).toHaveBeenCalledWith({
      orderIds: ['order-1'],
      notes: 'notes',
    });
    expect(refreshOrders).toHaveBeenCalled();
  });
});


