import { useCallback, useState } from 'react';
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

export interface DistanceMatrixPayload {
  destination_address_ids: string[];
  origin_address_id?: string;
  origin_address?: string; // Pre-formatted address string
}

export interface CachedDistanceMatrix {
  payload: DistanceMatrixPayload;
  response: DistanceMatrixResponse;
  timestamp: number;
}

// Cache duration in milliseconds (default: 10 minutes)
const CACHE_DURATION = 10 * 60 * 1000;

// In-memory cache for distance matrix data
let distanceMatrixCache: CachedDistanceMatrix | null = null;

export function useDistanceMatrix(cacheDuration: number = CACHE_DURATION) {
  const [data, setData] = useState<DistanceMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const isCacheValid = useCallback(
    (cachedData: CachedDistanceMatrix): boolean => {
      const now = Date.now();
      return now - cachedData.timestamp < cacheDuration;
    },
    [cacheDuration]
  );

  const isPayloadEqual = useCallback(
    (
      payload1: DistanceMatrixPayload,
      payload2: DistanceMatrixPayload
    ): boolean => {
      // Check if destination_address_ids arrays are equal
      if (
        payload1.destination_address_ids.length !==
        payload2.destination_address_ids.length
      ) {
        return false;
      }

      const sortedIds1 = [...payload1.destination_address_ids].sort();
      const sortedIds2 = [...payload2.destination_address_ids].sort();

      for (let i = 0; i < sortedIds1.length; i++) {
        if (sortedIds1[i] !== sortedIds2[i]) {
          return false;
        }
      }

      // Check origin_address_id
      if (payload1.origin_address_id !== payload2.origin_address_id) {
        return false;
      }

      // Check origin_address
      if (payload1.origin_address !== payload2.origin_address) {
        return false;
      }

      return true;
    },
    []
  );

  const fetchDistanceMatrix = useCallback(
    async (
      payload: DistanceMatrixPayload,
      forceRefresh = false
    ): Promise<DistanceMatrixResponse> => {
      setLoading(true);
      setError(null);

      try {
        // Check cache first (unless force refresh is requested)
        if (
          !forceRefresh &&
          distanceMatrixCache &&
          isCacheValid(distanceMatrixCache) &&
          isPayloadEqual(distanceMatrixCache.payload, payload)
        ) {
          console.log('Using cached distance matrix data');
          setData(distanceMatrixCache.response);
          setLoading(false);
          return distanceMatrixCache.response;
        }

        if (!apiClient) throw new Error('API client not available');

        console.log('Fetching distance matrix with payload:', payload);
        const response = await apiClient.post(
          '/google/distance-matrix',
          payload
        );

        // Cache the result
        const cachedData: CachedDistanceMatrix = {
          payload,
          response: response.data,
          timestamp: Date.now(),
        };
        distanceMatrixCache = cachedData;

        setData(response.data);
        return response.data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, isCacheValid, isPayloadEqual]
  );

  const clearCache = useCallback(() => {
    distanceMatrixCache = null;
    console.log('Distance matrix cache cleared');
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    fetchDistanceMatrix,
    clearCache,
    clearData,
  };
}
