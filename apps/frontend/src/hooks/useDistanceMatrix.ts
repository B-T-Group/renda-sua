import axios from 'axios';
import { useState } from 'react';

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

  const fetchDistanceMatrix = async (payload: {
    destination_address_ids: string[];
    origin_address_id?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/distance-matrix', payload);
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
