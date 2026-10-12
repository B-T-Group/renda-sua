import { api } from './apiClient';

export interface AgentContractLanguageNeeds {
  needsNationality: boolean;
  needsIdNumber: boolean;
}

export interface AgentContractStatus {
  required: boolean;
  signed: boolean;
  status: string | null;
  templateKey: string | null;
  language?: 'en' | 'fr';
  byLanguage?: Record<'en' | 'fr', AgentContractLanguageNeeds>;
  needsNationality: boolean;
  needsIdNumber: boolean;
  missingPhone: boolean;
  missingEmail: boolean;
  signerEmail: string | null;
}

interface StatusResponse {
  success: boolean;
  data: AgentContractStatus;
}

export const agentContractApi = {
  status: () => api.get<StatusResponse>('/agent-contracts/status'),
  ensure: (body: { language?: 'en' | 'fr'; nationality?: string; idNumber?: string }) =>
    api.post<StatusResponse>('/agent-contracts/ensure', body),
  resend: () => api.post<StatusResponse>('/agent-contracts/resend', {}),
  refresh: () => api.post<StatusResponse>('/agent-contracts/refresh', {}),
};
