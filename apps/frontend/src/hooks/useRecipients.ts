import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface SavedRecipient {
  id: string;
  user_id: string;
  country: string;
  name: string;
  phone: string;
  notify_whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecipientDto {
  country: string;
  name: string;
  phone: string;
  notify_whatsapp?: boolean;
}

export interface UpdateRecipientDto {
  name?: string;
  phone?: string;
  notify_whatsapp?: boolean;
}

type RecipientListener = () => void;
const recipientChangeListeners = new Set<RecipientListener>();

function emitRecipientChanges() {
  recipientChangeListeners.forEach((listener) => listener());
}

export function parseRecipientList(payload: unknown): SavedRecipient[] {
  if (Array.isArray(payload)) return payload as SavedRecipient[];
  if (payload && typeof payload === 'object' && 'recipients' in payload) {
    const nested = (payload as { recipients?: unknown }).recipients;
    if (Array.isArray(nested)) return nested as SavedRecipient[];
  }
  return [];
}

export function useRecipients(country?: string) {
  const apiClient = useApiClient();
  const [data, setData] = useState<SavedRecipient[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = country ? { country } : undefined;
      const response = await apiClient.get<unknown>('/recipients', { params });
      const list = parseRecipientList(response.data);
      setData(list);
      return list;
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message));
      setData([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, country]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const listener = () => {
      void refetch();
    };
    recipientChangeListeners.add(listener);
    return () => {
      recipientChangeListeners.delete(listener);
    };
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

function useRecipientMutation<TArg, TResult>(
  run: (arg: TArg) => Promise<TResult>
) {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(
    async (arg: TArg) => {
      setIsPending(true);
      try {
        const result = await run(arg);
        emitRecipientChanges();
        return result;
      } finally {
        setIsPending(false);
      }
    },
    [run]
  );
  return { mutateAsync, isPending };
}

export function useCreateRecipient() {
  const apiClient = useApiClient();
  const run = useCallback(
    async (data: CreateRecipientDto) => {
      const response = await apiClient.post<SavedRecipient>('/recipients', data);
      return response.data;
    },
    [apiClient]
  );
  return useRecipientMutation(run);
}

export function useUpdateRecipient() {
  const apiClient = useApiClient();
  const run = useCallback(
    async ({ id, data }: { id: string; data: UpdateRecipientDto }) => {
      const response = await apiClient.patch<SavedRecipient>(
        `/recipients/${id}`,
        data
      );
      return response.data;
    },
    [apiClient]
  );
  return useRecipientMutation(run);
}

export function useDeleteRecipient() {
  const apiClient = useApiClient();
  const run = useCallback(
    async (id: string) => {
      await apiClient.delete(`/recipients/${id}`);
    },
    [apiClient]
  );
  return useRecipientMutation(run);
}
