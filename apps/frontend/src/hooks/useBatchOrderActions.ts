import { useCallback } from 'react';
import {
  type BatchOrderStatusChangeItemResult,
  type BatchOrderStatusChangeRequest,
  type BatchOrderStatusChangeResponse,
  useBackendOrders,
} from './useBackendOrders';
import { useOrders } from './useOrders';

export interface BatchActionResult extends BatchOrderStatusChangeResponse {
  results: BatchOrderStatusChangeItemResult[];
}

export const useBatchOrderActions = () => {
  const {
    startPreparingBatch,
    completePreparationBatch,
    pickUpOrderBatch,
    startTransitBatch,
    outForDeliveryBatch,
    deliverOrderBatch,
  } = useBackendOrders();
  const { refreshOrders } = useOrders();

  const runBatchAction = useCallback(
    async (
      request: BatchOrderStatusChangeRequest,
      handler: (
        req: BatchOrderStatusChangeRequest
      ) => Promise<BatchOrderStatusChangeResponse>
    ): Promise<BatchActionResult> => {
      const response = await handler(request);
      await refreshOrders();
      return response;
    },
    [refreshOrders]
  );

  const batchStartPreparing = useCallback(
    (orderIds: string[], notes?: string) =>
      runBatchAction({ orderIds, notes }, startPreparingBatch),
    [runBatchAction, startPreparingBatch]
  );

  const batchCompletePreparation = useCallback(
    (orderIds: string[], notes?: string) =>
      runBatchAction({ orderIds, notes }, completePreparationBatch),
    [runBatchAction, completePreparationBatch]
  );

  const batchPickUp = useCallback(
    (orderIds: string[], notes?: string) =>
      runBatchAction({ orderIds, notes }, pickUpOrderBatch),
    [runBatchAction, pickUpOrderBatch]
  );

  const batchStartTransit = useCallback(
    (orderIds: string[], notes?: string) =>
      runBatchAction({ orderIds, notes }, startTransitBatch),
    [runBatchAction, startTransitBatch]
  );

  const batchOutForDelivery = useCallback(
    (orderIds: string[], notes?: string) =>
      runBatchAction({ orderIds, notes }, outForDeliveryBatch),
    [runBatchAction, outForDeliveryBatch]
  );

  const batchDeliver = useCallback(
    (orderIds: string[], notes?: string) =>
      runBatchAction({ orderIds, notes }, deliverOrderBatch),
    [runBatchAction, deliverOrderBatch]
  );

  return {
    batchStartPreparing,
    batchCompletePreparation,
    batchPickUp,
    batchStartTransit,
    batchOutForDelivery,
    batchDeliver,
  };
};


