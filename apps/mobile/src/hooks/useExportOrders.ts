import { useCallback } from 'react';
import {
  fetchExportOrder,
  fetchExportOrdersEnabled,
  fetchMyExportOrders,
  postBalanceOption,
  postConfirmDelivery,
  postProformaAction,
  type BalanceOption,
  type ProformaAction,
} from '../services/exportOrdersApi';

export function useExportOrders() {
  const getEnabled = useCallback(
    (countryCode?: string) => fetchExportOrdersEnabled(countryCode),
    []
  );
  const listMine = useCallback((page = 1, limit = 20) => fetchMyExportOrders(page, limit), []);
  const getOne = useCallback((id: string) => fetchExportOrder(id), []);
  const proformaAction = useCallback(
    (id: string, action: ProformaAction, notes?: string) =>
      postProformaAction(id, action, notes),
    []
  );
  const selectBalanceOption = useCallback(
    (id: string, option: BalanceOption) => postBalanceOption(id, option),
    []
  );
  const confirmDelivery = useCallback((id: string) => postConfirmDelivery(id), []);
  return { getEnabled, listMine, getOne, proformaAction, selectBalanceOption, confirmDelivery };
}
