import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ApplicationConfiguration {
  id: string;
  config_key: string;
  config_name: string;
  description?: string;
  data_type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'json'
    | 'array'
    | 'date'
    | 'currency';
  string_value?: string;
  number_value?: number;
  boolean_value?: boolean;
  json_value?: object;
  array_value?: string[];
  date_value?: string;
  country_code?: string | null;
  status: 'active' | 'inactive' | 'deprecated';
  version: number;
  tags?: string[];
  validation_rules?: object;
  min_value?: number;
  max_value?: number;
  allowed_values?: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface UpdateConfigurationRequest {
  config_name?: string;
  description?: string;
  data_type?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'json'
    | 'array'
    | 'date'
    | 'currency';
  string_value?: string;
  number_value?: number;
  boolean_value?: boolean;
  json_value?: object;
  array_value?: string[];
  date_value?: string;
  country_code?: string | null;
  status?: 'active' | 'inactive' | 'deprecated';
  version?: number;
  tags?: string[];
  validation_rules?: object;
  min_value?: number;
  max_value?: number;
  allowed_values?: string[];
}

export interface UseApplicationConfigurationsResult {
  configurations: ApplicationConfiguration[];
  loading: boolean;
  error: string | null;
  fetchConfigurations: (
    countryCode?: string,
    status?: string,
    tags?: string[]
  ) => Promise<void>;
  getConfigurationByKey: (
    key: string,
    countryCode?: string
  ) => ApplicationConfiguration | null;
  updateConfiguration: (
    id: string,
    updates: UpdateConfigurationRequest
  ) => Promise<ApplicationConfiguration>;
  deleteConfiguration: (id: string) => Promise<boolean>;
  refreshConfigurations: () => Promise<void>;
}

export const useApplicationConfigurations =
  (): UseApplicationConfigurationsResult => {
    const apiClient = useApiClient();
    const [configurations, setConfigurations] = useState<
      ApplicationConfiguration[]
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchConfigurations = useCallback(
      async (countryCode?: string, status?: string, tags?: string[]) => {
        setLoading(true);
        setError(null);

        try {
          const params = new URLSearchParams();
          if (countryCode) params.append('countryCode', countryCode);
          if (status) params.append('status', status);
          if (tags && tags.length > 0) params.append('tags', tags.join(','));

          const response = await apiClient.get<ApplicationConfiguration[]>(
            `/admin/configurations?${params.toString()}`
          );
          setConfigurations(response.data);
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.message ||
            err.message ||
            'Failed to fetch configurations';
          setError(errorMessage);
          console.error('Failed to fetch configurations:', err);
        } finally {
          setLoading(false);
        }
      },
      [apiClient]
    );

    const getConfigurationByKey = useCallback(
      (key: string, countryCode?: string): ApplicationConfiguration | null => {
        return (
          configurations.find(
            (config) =>
              config.config_key === key &&
              config.country_code === (countryCode || null)
          ) || null
        );
      },
      [configurations]
    );

    const updateConfiguration = useCallback(
      async (
        id: string,
        updates: UpdateConfigurationRequest
      ): Promise<ApplicationConfiguration> => {
        try {
          const response = await apiClient.patch<ApplicationConfiguration>(
            `/admin/configurations/${id}`,
            updates
          );

          // Update the configurations list with the updated item
          setConfigurations((prev) =>
            prev.map((config) => (config.id === id ? response.data : config))
          );

          return response.data;
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.message ||
            err.message ||
            'Failed to update configuration';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      },
      [apiClient]
    );

    const deleteConfiguration = useCallback(
      async (id: string): Promise<boolean> => {
        try {
          const response = await apiClient.delete<{
            success: boolean;
            message: string;
          }>(`/admin/configurations/${id}`);

          if (response.data.success) {
            // Remove the deleted configuration from the list
            setConfigurations((prev) =>
              prev.filter((config) => config.id !== id)
            );
            return true;
          }
          return false;
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.message ||
            err.message ||
            'Failed to delete configuration';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      },
      [apiClient]
    );

    const refreshConfigurations = useCallback(async () => {
      await fetchConfigurations();
    }, [fetchConfigurations]);

    // Load configurations on mount
    useEffect(() => {
      fetchConfigurations();
    }, [fetchConfigurations]);

    return {
      configurations,
      loading,
      error,
      fetchConfigurations,
      getConfigurationByKey,
      updateConfiguration,
      deleteConfiguration,
      refreshConfigurations,
    };
  };
