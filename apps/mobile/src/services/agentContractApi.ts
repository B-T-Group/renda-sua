import { api } from './apiClient';

export interface AgentContractStatus {
  required: boolean;
  signed: boolean;
  status: string | null;
  templateKey: string | null;
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
  ensure: (body: { nationality?: string; idNumber?: string }) =>
    api.post<StatusResponse>('/agent-contracts/ensure', body),
  resend: () => api.post<StatusResponse>('/agent-contracts/resend', {}),
  refresh: () => api.post<StatusResponse>('/agent-contracts/refresh', {}),
};
