import { useCallback } from 'react';
import {
  fetchBusinessProductInterest,
  fetchClientProductInterest,
  submitProductInterest,
} from '../services/productInterestApi';

export function useProductInterest() {
  const submitInterest = useCallback(
    (businessInventoryId: string, note?: string) =>
      submitProductInterest(businessInventoryId, note),
    []
  );
  const listClient = useCallback(
    (page = 1, limit = 20) => fetchClientProductInterest(page, limit),
    []
  );
  const listBusiness = useCallback(
    (page = 1, limit = 20, locationId?: string) =>
      fetchBusinessProductInterest(page, limit, locationId),
    []
  );
  return { submitInterest, listClient, listBusiness };
}
