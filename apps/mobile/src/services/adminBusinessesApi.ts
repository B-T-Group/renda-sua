import { apiRequest } from './apiClient';
import { fetchUploadViewUrl } from './uploadsApi';
import type {
  AdminBusinessesListResult,
  AdminBusinessVerificationDetails,
} from '../types/adminBusinesses';

export { fetchUploadViewUrl };

export async function fetchAdminBusinesses(params: {
  page?: number;
  limit?: number;
  search?: string;
  lifecycleStatus?: string;
  idDocumentStatus?: string;
  needsAttention?: boolean;
}): Promise<AdminBusinessesListResult> {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  if (params.search?.trim()) search.set('search', params.search.trim());
  if (params.lifecycleStatus)
    search.set('lifecycleStatus', params.lifecycleStatus);
  if (params.idDocumentStatus)
    search.set('idDocumentStatus', params.idDocumentStatus);
  if (params.needsAttention) search.set('needsAttention', 'true');
  const res = await apiRequest<{
    success: boolean;
    items?: AdminBusinessesListResult['items'];
    total?: number;
    page?: number;
    limit?: number;
    error?: string;
  }>(`/admin/businesses?${search.toString()}`, { method: 'GET' });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load businesses');
  }
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    limit: res.limit ?? params.limit ?? 20,
  };
}

export async function fetchAdminBusinessVerification(
  businessId: string
): Promise<AdminBusinessVerificationDetails> {
  const res = await apiRequest<{
    success: boolean;
    data?: AdminBusinessVerificationDetails;
    error?: string;
  }>(`/admin/businesses/${encodeURIComponent(businessId)}/verification`, {
    method: 'GET',
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Failed to load verification details');
  }
  return res.data;
}

export async function confirmMobileMoneyReady(
  businessId: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/businesses/${encodeURIComponent(businessId)}/payment-accounts/mobile_money/verify`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export async function resendBusinessContract(
  businessId: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/businesses/${encodeURIComponent(businessId)}/contract/resend`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export async function fetchBusinessContractDownloadUrl(
  businessId: string,
  contractId: string
): Promise<string | null> {
  const res = await apiRequest<{
    success: boolean;
    data?: { url?: string };
    error?: string;
  }>(
    `/admin/businesses/${encodeURIComponent(businessId)}/contract/${encodeURIComponent(contractId)}/download`,
    { method: 'GET' }
  );
  return res.success ? res.data?.url ?? null : null;
}

export async function approveUpload(uploadId: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/uploads/${encodeURIComponent(uploadId)}/approve`,
    { method: 'PATCH', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export async function rejectUpload(
  uploadId: string,
  message: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/uploads/${encodeURIComponent(uploadId)}/reject`,
    {
      method: 'PATCH',
      body: JSON.stringify({ message }),
    }
  );
  return !!res.success;
}

export async function adminChangeBusinessAccountType(
  businessId: string,
  accountType: string,
  reason?: string
): Promise<{ accountType: string; commissionPercentage: number; lockedUntil: string | null }> {
  const res = await apiRequest<{
    success: boolean;
    accountType?: string;
    commissionPercentage?: number;
    lockedUntil?: string | null;
    error?: string;
  }>(`/admin/businesses/${encodeURIComponent(businessId)}/account-type`, {
    method: 'PATCH',
    body: JSON.stringify({ accountType, reason }),
  });
  if (!res.success || res.accountType == null) {
    throw new Error(res.error || 'Failed to change account type');
  }
  return {
    accountType: res.accountType,
    commissionPercentage: res.commissionPercentage ?? 12,
    lockedUntil: res.lockedUntil ?? null,
  };
}

export async function suspendBusiness(
  businessId: string,
  reason: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/businesses/${encodeURIComponent(businessId)}/suspend`,
    { method: 'POST', body: JSON.stringify({ reason }) }
  );
  if (!res.success) {
    throw new Error(res.error || 'Failed to suspend business');
  }
  return true;
}

export async function reinstateBusiness(businessId: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/businesses/${encodeURIComponent(businessId)}/reinstate`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  if (!res.success) {
    throw new Error(res.error || 'Failed to reinstate business');
  }
  return true;
}

export async function applyAdminBusinessReferral(
  businessId: string,
  code: string
): Promise<void> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/businesses/${encodeURIComponent(businessId)}/referral`,
    { method: 'POST', body: JSON.stringify({ code }) }
  );
  if (!res.success) throw new Error(res.error || 'Failed to apply referral');
}

export const adminBusinessesApi = {
  fetchAdminBusinesses,
  fetchAdminBusinessVerification,
  confirmMobileMoneyReady,
  resendBusinessContract,
  fetchBusinessContractDownloadUrl,
  fetchUploadViewUrl,
  approveUpload,
  rejectUpload,
  adminChangeBusinessAccountType,
  suspendBusiness,
  reinstateBusiness,
  applyAdminBusinessReferral,
};
