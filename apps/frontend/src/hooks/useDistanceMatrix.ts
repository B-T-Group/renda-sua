import axios from 'axios';
import { useState } from 'react';

export function useDistanceMatrix() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDistance = async (origins: string[], destinations: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        origins: origins.join(','),
        destinations: destinations.join(','),
      };
      const response = await axios.get('/api/distance-matrix', { params });
      setData(response.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchDistance };
}
