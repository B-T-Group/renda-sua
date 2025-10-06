import { useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

export interface SupportedPaymentSystem {
  id: string;
  name: string;
  country: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupportedPaymentSystemsResponse {
  supported_payment_systems: SupportedPaymentSystem[];
}

export const useSupportedPaymentSystems = () => {
  const { baseClient } = useGraphQLClient();
  const [paymentSystems, setPaymentSystems] = useState<
    SupportedPaymentSystem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentSystems = async () => {
      try {
        setLoading(true);
        setError(null);

        const query = `
          query GetSupportedPaymentSystems {
            supported_payment_systems(where: { active: { _eq: true } }) {
              id
              name
              country
              active
              created_at
              updated_at
            }
          }
        `;

        const result =
          await baseClient.request<SupportedPaymentSystemsResponse>(query);

        setPaymentSystems(result.supported_payment_systems);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to fetch payment systems';
        setError(errorMessage);
        console.error('Error fetching supported payment systems:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentSystems();
  }, [baseClient]);

  // Helper function to check if a country code is supported
  const isCountrySupported = (countryCode: string): boolean => {
    return paymentSystems.some(
      (system) => system.country.toUpperCase() === countryCode.toUpperCase()
    );
  };

  // Get supported countries list
  const supportedCountries = paymentSystems.map((system) => system.country);

  // Get unique supported countries
  const uniqueSupportedCountries = Array.from(new Set(supportedCountries));

  return {
    paymentSystems,
    loading,
    error,
    isCountrySupported,
    supportedCountries: uniqueSupportedCountries,
  };
};
