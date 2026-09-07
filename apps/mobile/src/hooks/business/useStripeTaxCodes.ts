import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/apiClient';

export const STRIPE_TAX_CODE_GENERAL_TANGIBLE = 'txcd_99999999';

export interface StripeTaxCodeOption {
  id: string;
  name: string;
  description?: string | null;
  groupName?: string | null;
}

interface StripeTaxCodesResponse {
  codes?: StripeTaxCodeOption[];
  data?: { codes?: StripeTaxCodeOption[] };
}

export function unwrapStripeTaxCodes(res: unknown): StripeTaxCodeOption[] {
  if (!res || typeof res !== 'object') return [];
  const rec = res as StripeTaxCodesResponse;
  const codes = rec.codes ?? rec.data?.codes;
  return Array.isArray(codes) ? codes : [];
}

export function useStripeTaxCodes() {
  const [codes, setCodes] = useState<StripeTaxCodeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const search = useCallback(async (term?: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (term?.trim()) params.set('search', term.trim());
      params.set('limit', '200');
      const res = await api.get<StripeTaxCodesResponse>(
        `/stripe-tax/codes?${params.toString()}`
      );
      if (id !== requestId.current) return;
      setCodes(unwrapStripeTaxCodes(res));
    } catch (e: unknown) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load tax categories');
      setCodes([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void search();
  }, [search]);

  return { codes, loading, error, search };
}
