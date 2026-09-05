export const CONTRACT_DOC_TYPE = 'rendasua_contract_agreement';

export type SignedContractHint = {
  canDownload?: boolean;
  contractId?: string | null;
  boldSignEnabled?: boolean;
};

export type SignedPdfApiClient = {
  get: <T = unknown>(url: string) => Promise<{ data: T }>;
};

type ContractUpload = {
  id: string;
  created_at?: string;
  document_type?: { name?: string };
};

type UploadViewPayload = {
  presigned_url?: string;
  data?: { presigned_url?: string; url?: string };
};

export function selectLatestContractUploadId(
  uploads: ContractUpload[]
): string | null {
  const matches = uploads.filter(
    (u) => u.document_type?.name === CONTRACT_DOC_TYPE
  );
  matches.sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );
  return matches[0]?.id ?? null;
}

export function pickUploadViewUrl(
  view: UploadViewPayload | null | undefined
): string | null {
  return (
    view?.presigned_url ||
    view?.data?.presigned_url ||
    view?.data?.url ||
    null
  );
}

export function shouldUseBoldSignDownload(
  contract: SignedContractHint | null
): boolean {
  return Boolean(contract?.canDownload && contract.contractId);
}

async function fetchBoldSignPdfUrl(
  apiClient: SignedPdfApiClient,
  contract: SignedContractHint
): Promise<string | null> {
  const bold = await apiClient.get<{
    success: boolean;
    data: { url?: string };
  }>(`/business-contracts/${contract.contractId}/download`);
  return bold.data.data?.url ?? null;
}

async function fetchUploadContractPdfUrl(
  apiClient: SignedPdfApiClient
): Promise<string | null> {
  const res = await apiClient.get<{
    success: boolean;
    data: { uploads: ContractUpload[] };
  }>('/uploads/me');
  const uploadId = selectLatestContractUploadId(res.data.data.uploads ?? []);
  if (!uploadId) return null;
  const view = await apiClient.get<UploadViewPayload>(
    `/uploads/${uploadId}/view`
  );
  return pickUploadViewUrl(view.data);
}

export async function resolveSignedPdfUrl(
  apiClient: SignedPdfApiClient,
  contract: SignedContractHint | null
): Promise<string | null> {
  if (shouldUseBoldSignDownload(contract) && contract) {
    return fetchBoldSignPdfUrl(apiClient, contract);
  }
  // BoldSign rail without a downloadable PDF yet — do not open a stale upload.
  if (contract?.boldSignEnabled) return null;
  return fetchUploadContractPdfUrl(apiClient);
}
