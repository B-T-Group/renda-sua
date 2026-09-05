import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useRecipients(country?: string) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['recipients', country],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (country) {
        params.append('country', country);
      }
      const response = await apiClient.get<SavedRecipient[]>(
        `/recipients?${params.toString()}`
      );
      return response.data;
    },
  });
}

export function useCreateRecipient() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRecipientDto) => {
      const response = await apiClient.post<SavedRecipient>('/recipients', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
    },
  });
}

export function useUpdateRecipient() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRecipientDto }) => {
      const response = await apiClient.patch<SavedRecipient>(`/recipients/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
    },
  });
}

export function useDeleteRecipient() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/recipients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
    },
  });
}
