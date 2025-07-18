import { useState } from 'react';
import { useApiClient } from './useApiClient';

export interface DistanceMatrixElement {
  status: string;
  duration?: { text: string; value: number };
  duration_in_traffic?: { text: string; value: number };
  distance?: { text: string; value: number };
  fare?: { currency: string; value: number; text: string };
}
export interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}
export interface DistanceMatrixResponse {
  origin_id: string | null;
  destination_ids: string[];
  origin_addresses: string[];
  destination_addresses: string[];
  rows: DistanceMatrixRow[];
  status: string;
}

export function useDistanceMatrix() {
  const [data, setData] = useState<DistanceMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchDistanceMatrix = async (payload: {
    destination_address_ids: string[];
    origin_address_id?: string;
    origin_address?: string; // Pre-formatted address string
  }) => {
    setLoading(true);
    setError(null);
    try {
      if (!apiClient) throw new Error('API client not available');
      const response = await apiClient.post('/google/distance-matrix', payload);
      setData(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchDistanceMatrix };
}
