import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

const PRINT_DELAY_MS = 1000;
const FILENAME = 'shipping-label.pdf';

function openBlobInNewWindow(url: string): Window | null {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return null;
  w.location.href = url;
  return w;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function printBlob(blob: Blob, onFallback?: () => void): void {
  const url = URL.createObjectURL(blob);
  const w = openBlobInNewWindow(url);
  if (!w) {
    URL.revokeObjectURL(url);
    downloadBlob(blob, FILENAME);
    onFallback?.();
    return;
  }
  const tid = window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, PRINT_DELAY_MS);
  w.addEventListener('beforeunload', () => clearTimeout(tid));
}

export interface PrintLabelAndPrintOptions {
  onSuccess?: () => void;
  /** Invoked when popup is blocked and we fall back to download. Receives message to show. */
  onFallback?: (message: string) => void;
  /** Optional translated fallback message; passed to onFallback when provided. */
  fallbackMessage?: string;
}

export function useShippingLabels() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printLabel = useCallback(
    async (orderId: string): Promise<Blob | null> => {
      if (!apiClient) {
        setError('API client not available');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.get<Blob>(
          `/pdf/shipping-labels/${orderId}`,
          { responseType: 'blob' }
        );
        const raw = data instanceof Blob ? data : new Blob([data as BlobPart]);
        return new Blob([raw], { type: 'application/pdf' });
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: unknown } }).response?.data
            : null;
        const message =
          typeof msg === 'string'
            ? msg
            : msg && typeof msg === 'object' && 'message' in msg
              ? String((msg as { message: unknown }).message)
              : err instanceof Error
                ? err.message
                : 'Failed to generate shipping label';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const printLabelAndPrint = useCallback(
    async (
      orderId: string,
      options?: PrintLabelAndPrintOptions
    ): Promise<void> => {
      const defaultFallback =
        'Popup blocked. Label downloaded — open the file and print from your PDF viewer.';
      try {
        const blob = await printLabel(orderId);
        if (!blob) return;
        const msg = options?.fallbackMessage ?? defaultFallback;
        printBlob(blob, () => options?.onFallback?.(msg));
        options?.onSuccess?.();
      } catch {
        /* printLabel already sets error and throws; caller handles */
      }
    },
    [printLabel]
  );

  return { printLabel, printLabelAndPrint, loading, error };
}
