import { useCallback } from 'react';
import { useLoading } from '../contexts/LoadingContext';

interface UseApiWithLoadingOptions {
  loadingMessage?: string;
  showLoading?: boolean;
}

export const useApiWithLoading = (options: UseApiWithLoadingOptions = {}) => {
  const { showLoading, hideLoading, setLoadingMessage } = useLoading();
  const { loadingMessage, showLoading: shouldShowLoading = true } = options;

  const callWithLoading = useCallback(
    async <T>(
      apiCall: () => Promise<T>,
      customLoadingMessage?: string
    ): Promise<T> => {
      if (shouldShowLoading) {
        showLoading(customLoadingMessage || loadingMessage);
      }

      try {
        const result = await apiCall();
        return result;
      } finally {
        if (shouldShowLoading) {
          hideLoading();
        }
      }
    },
    [showLoading, hideLoading, loadingMessage, shouldShowLoading]
  );

  const callWithProgress = useCallback(
    async <T>(
      apiCall: () => Promise<T>,
      progressMessages: string[]
    ): Promise<T> => {
      if (!shouldShowLoading) {
        return await apiCall();
      }

      showLoading(progressMessages[0] || loadingMessage);

      try {
        const result = await apiCall();
        return result;
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading, loadingMessage, shouldShowLoading]
  );

  return {
    callWithLoading,
    callWithProgress,
    showLoading,
    hideLoading,
    setLoadingMessage,
  };
};
