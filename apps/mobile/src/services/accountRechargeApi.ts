import { apiRequest } from './apiClient';

export interface RechargeTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  provider: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  customer_phone?: string;
  transaction_id?: string;
  error_message?: string;
  payment_entity?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountTopUpRecord {
  id: string;
  amount: number;
  memo: string;
  created_at: string;
  reference_id: string | null;
}

export interface InitiateRechargeParams {
  countryCode: string;
  phoneNumber: string;
  amount: number;
}

export interface InitiateRechargeResult {
  transactionId: string;
  providerTransactionId?: string;
  provider?: string;
  message?: string;
}

export async function initiateAccountRecharge(
  params: InitiateRechargeParams
): Promise<InitiateRechargeResult> {
  const res = await apiRequest<{ success: boolean; data?: InitiateRechargeResult; message?: string }>(
    '/admin/account-recharge/initiate',
    { method: 'POST', body: JSON.stringify(params) }
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Failed to initiate recharge');
  }
  return res.data;
}

export async function getRechargeTransactionStatus(
  transactionId: string
): Promise<RechargeTransaction> {
  const res = await apiRequest<{ success: boolean; data?: RechargeTransaction; message?: string }>(
    `/admin/account-recharge/transactions/${transactionId}/status`,
    { method: 'GET' }
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Failed to get transaction status');
  }
  return res.data;
}

export async function fetchRecentRecharges(
  limit = 20,
  offset = 0
): Promise<AccountTopUpRecord[]> {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await apiRequest<{ success: boolean; data?: { items: AccountTopUpRecord[] }; message?: string }>(
    `/admin/account-recharge/recent?${qs.toString()}`,
    { method: 'GET' }
  );
  return res.data?.items ?? [];
}
