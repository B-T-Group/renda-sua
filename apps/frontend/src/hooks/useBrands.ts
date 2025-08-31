import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

export interface Brand {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface UseBrandsResult {
  brands: Brand[];
  loading: boolean;
  error: string | null;
  fetchBrands: () => Promise<void>;
  createBrand: (brandData: {
    name: string;
    description?: string;
  }) => Promise<Brand>;
}

export const useBrands = (): UseBrandsResult => {
  const { client } = useGraphQLClient();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setError(null);

    try {
      const query = `
        query GetBrands {
          brands(order_by: { name: asc }) {
            id
            name
            description
            created_at
            updated_at
          }
        }
      `;

      const response = await client.request(query);
      const brandsData = response.brands || [];

      setBrands(brandsData);
    } catch (err) {
      console.error('Error fetching brands:', err);
      setError('Failed to fetch brands');
    } finally {
      setLoading(false);
    }
  }, [client]);

  const createBrand = useCallback(
    async (brandData: {
      name: string;
      description?: string;
    }): Promise<Brand> => {
      if (!client) {
        throw new Error('GraphQL client not available');
      }

      try {
        const mutation = `
           mutation CreateBrand($name: String!, $description: String) {
             insert_brands_one(object: {
               name: $name,
               description: $description
             }) {
               id
               name
               description
               created_at
               updated_at
             }
           }
         `;

        const response = await client.request(mutation, brandData);
        const newBrand = response.insert_brands_one;

        if (newBrand) {
          // Add the new brand to the local state
          setBrands((prev) =>
            [...prev, newBrand].sort((a, b) => a.name.localeCompare(b.name))
          );
          return newBrand;
        } else {
          throw new Error('Failed to create brand');
        }
      } catch (err) {
        console.error('Error creating brand:', err);
        throw err;
      }
    },
    [client]
  );

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return {
    brands,
    loading,
    error,
    fetchBrands,
    createBrand,
  };
};
