import {
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  VerifiedUser as VerifiedUserIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { MerchantStatusChip } from '../business/MerchantStatusChip';
import { AdminBusinessVerificationSteps } from './AdminBusinessVerificationSteps';

export type AdminVerificationBlocker =
  | 'missing_signed_contract'
  | 'missing_active_location'
  | 'missing_approved_product'
  | 'missing_payment_verification';

export type AdminPaymentRail = 'stripe' | 'mobile_money';

export interface BusinessIdDocument {
  id: string;
  file_name: string;
  content_type?: string | null;
  is_approved: boolean;
  note?: string | null;
  document_type?: { name: string };
}

export interface BusinessVerificationDetails {
  business: {
    id: string;
    name: string;
    is_verified: boolean;
    lifecycle_status?: string;
    is_storefront_visible?: boolean;
    can_accept_orders?: boolean;
    user: { first_name: string; last_name: string; email: string };
  };
  latestAcceptance: {
    signer_legal_name: string;
    agreement_version: string;
    accepted_at: string;
    pdf_upload_id?: string | null;
  } | null;
  latestContract?: {
    complete: boolean;
    status: string | null;
    version: string | null;
    acceptedAt: string | null;
    contractId: string | null;
    canDownload: boolean;
    boldSignEnabled?: boolean;
  } | null;
  identityDocuments: BusinessIdDocument[];
  paymentAccounts?: Array<{
    id: string;
    provider: string;
    capability_status: string;
    rejection_reason?: string | null;
  }>;
  rail?: AdminPaymentRail;
  blockers?: AdminVerificationBlocker[];
  catalog?: {
    complete: boolean;
    hasLocation: boolean;
    hasApprovedItem: boolean;
    hasPendingItem: boolean;
  };
}

export interface AdminBusinessVerificationDialogProps {
  open: boolean;
  businessId: string | null;
  businessName?: string;
  ownerName?: string;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

function isImageContentType(contentType?: string | null, fileName?: string) {
  if (contentType?.startsWith('image/')) return true;
  const lower = (fileName || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some((ext) =>
    lower.endsWith(ext)
  );
}

function isPdfContentType(contentType?: string | null, fileName?: string) {
  if (contentType === 'application/pdf') return true;
  return (fileName || '').toLowerCase().endsWith('.pdf');
}

function blockerLabel(
  blocker: AdminVerificationBlocker,
  t: (key: string, fallback: string) => string
): string {
  switch (blocker) {
    case 'missing_signed_contract':
      return t(
        'admin.businesses.blockers.missingSignedContract',
        'Missing: signed contract'
      );
    case 'missing_active_location':
      return t(
        'admin.businesses.blockers.missingActiveLocation',
        'Missing: active location'
      );
    case 'missing_approved_product':
      return t(
        'admin.businesses.blockers.missingApprovedProduct',
        'Missing: approved product'
      );
    case 'missing_payment_verification':
      return t(
        'admin.businesses.blockers.missingPaymentVerification',
        'Missing: payment verification'
      );
    default:
      return blocker;
  }
}

export const AdminBusinessVerificationDialog: React.FC<
  AdminBusinessVerificationDialogProps
> = ({ open, businessId, businessName, ownerName, onClose, onUpdated }) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();

  const [details, setDetails] = useState<BusinessVerificationDetails | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [approveLoadingId, setApproveLoadingId] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [previewUrlById, setPreviewUrlById] = useState<Record<string, string>>(
    {}
  );
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const previewRequestedRef = React.useRef<Set<string>>(new Set());
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const [contractActionError, setContractActionError] = useState<string | null>(
    null
  );

  const fetchDetails = useCallback(
    async (id: string) => {
      if (!apiClient) return;
      setLoading(true);
      setLoadError(null);
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          data: BusinessVerificationDetails;
          error?: string;
        }>(`/admin/businesses/${id}/verification`);
        if (!data.success || !data.data) {
          setDetails(null);
          setLoadError(
            data.error ||
              t(
                'admin.businesses.verificationLoadError',
                'Failed to load verification details'
              )
          );
          return;
        }
        if (!data.data.business) {
          setDetails(null);
          setLoadError(
            t(
              'admin.businesses.verificationLoadError',
              'Failed to load verification details'
            )
          );
          return;
        }
        setDetails(data.data);
      } catch (error: any) {
        setDetails(null);
        setLoadError(
          error?.message ||
            t(
              'admin.businesses.verificationLoadError',
              'Failed to load verification details'
            )
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient, t]
  );

  useEffect(() => {
    if (open && businessId) {
      setContractActionError(null);
      setPreviewUrlById({});
      previewRequestedRef.current = new Set();
      void fetchDetails(businessId);
    } else if (!open) {
      setDetails(null);
      setLoadError(null);
    }
  }, [open, businessId, fetchDetails]);

  const ensurePreviewUrl = useCallback(
    async (uploadId: string) => {
      if (!apiClient) return undefined;
      if (previewRequestedRef.current.has(uploadId)) return undefined;
      previewRequestedRef.current.add(uploadId);
      setPreviewLoadingId(uploadId);
      try {
        const { data } = await apiClient.get<{
          success?: boolean;
          presigned_url?: string;
          data?: { presigned_url?: string; url?: string };
        }>(`/uploads/${uploadId}/view`);
        const url =
          data.presigned_url ||
          data.data?.presigned_url ||
          data.data?.url ||
          '';
        if (url) {
          setPreviewUrlById((prev) => ({ ...prev, [uploadId]: url }));
          return url;
        }
        previewRequestedRef.current.delete(uploadId);
        return undefined;
      } catch {
        previewRequestedRef.current.delete(uploadId);
        return undefined;
      } finally {
        setPreviewLoadingId(null);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    if (!details?.identityDocuments?.length) return;
    details.identityDocuments.forEach((doc) => {
      void ensurePreviewUrl(doc.id);
    });
  }, [details?.identityDocuments, ensurePreviewUrl]);

  const agreementComplete = Boolean(
    details?.latestContract?.complete || details?.latestAcceptance
  );
  const hasApprovedId = Boolean(
    details?.identityDocuments?.some((doc) => doc.is_approved)
  );
  const rail: AdminPaymentRail = details?.rail ?? 'mobile_money';
  const mmAccount = details?.paymentAccounts?.find(
    (a) => a.provider === 'mobile_money'
  );
  const mmVerified = mmAccount?.capability_status === 'verified';
  const stripeAccount = details?.paymentAccounts?.find(
    (a) => a.provider === 'stripe'
  );
  const canConfirmMobileMoney =
    rail === 'mobile_money' &&
    !mmVerified &&
    agreementComplete &&
    hasApprovedId;
  const contractIsSigned =
    details?.latestContract?.complete === true ||
    details?.latestContract?.status === 'signed';
  const canResendContract =
    Boolean(details?.latestContract?.boldSignEnabled) && !contractIsSigned;
  const catalog = details?.catalog;
  const draftBlockers = useMemo(
    () =>
      (details?.blockers ?? []).filter(
        (b) =>
          b === 'missing_signed_contract' ||
          b === 'missing_active_location' ||
          b === 'missing_approved_product'
      ),
    [details?.blockers]
  );

  const handleResendContract = useCallback(async () => {
    if (!apiClient || !businessId) return;
    setContractActionLoading(true);
    setContractActionError(null);
    try {
      await apiClient.post(`/admin/businesses/${businessId}/contract/resend`);
      await fetchDetails(businessId);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        t(
          'admin.businesses.resendContractFailed',
          'Could not resend the contract reminder.'
        );
      setContractActionError(
        typeof message === 'string' ? message : String(message)
      );
    } finally {
      setContractActionLoading(false);
    }
  }, [apiClient, businessId, fetchDetails, t]);

  const handleDownloadContract = useCallback(
    async (contractId: string) => {
      if (!apiClient || !businessId) return;
      setContractActionLoading(true);
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: { url: string };
        }>(
          `/admin/businesses/${businessId}/contract/${contractId}/download`
        );
        if (res.data.success && res.data.data.url) {
          window.open(res.data.data.url, '_blank', 'noopener,noreferrer');
        }
      } finally {
        setContractActionLoading(false);
      }
    },
    [apiClient, businessId]
  );

  const handleApproveUpload = useCallback(
    async (uploadId: string) => {
      if (!apiClient || !businessId) return;
      setApproveLoadingId(uploadId);
      try {
        await apiClient.patch(`/uploads/${uploadId}/approve`);
        await fetchDetails(businessId);
        await onUpdated();
      } finally {
        setApproveLoadingId(null);
      }
    },
    [apiClient, businessId, fetchDetails, onUpdated]
  );

  const handleRejectUpload = useCallback(async () => {
    if (!apiClient || !businessId || !rejectingDocId || !rejectMessage.trim()) {
      return;
    }
    setRejectLoading(true);
    try {
      await apiClient.patch(`/uploads/${rejectingDocId}/reject`, {
        message: rejectMessage.trim(),
      });
      setRejectingDocId(null);
      setRejectMessage('');
      await fetchDetails(businessId);
      await onUpdated();
    } finally {
      setRejectLoading(false);
    }
  }, [
    apiClient,
    businessId,
    rejectingDocId,
    rejectMessage,
    fetchDetails,
    onUpdated,
  ]);

  const handleConfirmMobileMoney = useCallback(async () => {
    if (!apiClient || !businessId) return;
    setVerifyLoading(true);
    try {
      await apiClient.post(
        `/admin/businesses/${businessId}/payment-accounts/mobile_money/verify`
      );
      await fetchDetails(businessId);
      await onUpdated();
    } finally {
      setVerifyLoading(false);
    }
  }, [apiClient, businessId, fetchDetails, onUpdated]);

  const titleName =
    businessName || details?.business?.name || t('admin.businesses.unnamed', 'Business');
  const titleOwner =
    ownerName ||
    (details?.business?.user
      ? `${details.business.user.first_name} ${details.business.user.last_name}`
      : '');

  return (
    <>
      <Dialog open={open} onClose={onClose} fullScreen>
        <AppBar sx={{ position: 'sticky' }} color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={onClose} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0, ml: 1 }}>
              <Typography variant="h6" noWrap>
                {t('admin.businesses.verificationTitle', 'Business verification')}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {titleName}
                {titleOwner ? ` — ${titleOwner}` : ''}
              </Typography>
            </Box>
            {details?.business ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  label={
                    rail === 'stripe'
                      ? t('admin.businesses.railStripe', 'Stripe')
                      : t('admin.businesses.railMobileMoney', 'Mobile money')
                  }
                  variant="outlined"
                />
                <MerchantStatusChip
                  lifecycleStatus={details.business.lifecycle_status}
                  canAcceptOrders={details.business.can_accept_orders}
                  isStorefrontVisible={details.business.is_storefront_visible}
                />
              </Stack>
            ) : null}
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ bgcolor: 'background.default' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : loadError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {loadError}
            </Alert>
          ) : details?.business ? (
            <Box
              sx={{
                maxWidth: 960,
                mx: 'auto',
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {details.business.lifecycle_status === 'created' &&
              draftBlockers.length > 0 ? (
                <Alert severity="info">
                  {t(
                    'admin.businesses.draftNextStep',
                    'Still Draft — next step: {{step}}',
                    { step: blockerLabel(draftBlockers[0], t) }
                  )}
                </Alert>
              ) : null}

              <AdminBusinessVerificationSteps
                summary={{
                  contractComplete: agreementComplete,
                  contractStatus: contractIsSigned
                    ? 'signed'
                    : details.latestContract?.status ||
                      (details.latestAcceptance ? 'legacy_signed' : 'missing'),
                  idDocumentStatus: hasApprovedId
                    ? 'approved'
                    : details.identityDocuments.length === 0
                      ? 'missing'
                      : details.identityDocuments.some((d) => d.note?.trim())
                        ? 'rejected'
                        : 'pending',
                }}
              />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={agreementComplete ? 'success' : 'default'}
                  label={t('admin.businesses.checklist.contract', 'Contract')}
                />
                <Chip
                  size="small"
                  color={hasApprovedId ? 'success' : 'warning'}
                  label={t('admin.businesses.checklist.identity', 'Identity')}
                />
                <Chip
                  size="small"
                  color={
                    rail === 'stripe'
                      ? stripeAccount?.capability_status === 'verified'
                        ? 'success'
                        : 'warning'
                      : mmVerified
                        ? 'success'
                        : 'warning'
                  }
                  label={t('admin.businesses.checklist.payment', 'Payment')}
                />
                <Chip
                  size="small"
                  color={catalog?.complete ? 'success' : 'warning'}
                  label={t('admin.businesses.checklist.catalog', 'Catalog')}
                />
              </Stack>

              {/* Contract */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('admin.businesses.checklist.contract', 'Contract')}
                </Typography>
                {details.latestContract?.boldSignEnabled ? (
                  <>
                    <Chip
                      size="small"
                      color={contractIsSigned ? 'success' : 'warning'}
                      label={
                        contractIsSigned
                          ? t('admin.businesses.contractSigned', 'Signed')
                          : details.latestContract.status ||
                            t('admin.businesses.contractPending', 'Pending')
                      }
                      sx={{ mb: 1 }}
                    />
                    {contractActionError ? (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        {contractActionError}
                      </Alert>
                    ) : null}
                    {details.latestContract.version ? (
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.businesses.contractVersion', 'Version')}:{' '}
                        {details.latestContract.version}
                      </Typography>
                    ) : null}
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {canResendContract ? (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={contractActionLoading}
                          onClick={() => void handleResendContract()}
                        >
                          {t('admin.businesses.resendContract', 'Resend contract')}
                        </Button>
                      ) : null}
                      {details.latestContract.contractId &&
                      details.latestContract.canDownload ? (
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          disabled={contractActionLoading}
                          onClick={() =>
                            void handleDownloadContract(
                              details.latestContract!.contractId!
                            )
                          }
                        >
                          {t(
                            'admin.businesses.viewAgreementPdf',
                            'View signed PDF'
                          )}
                        </Button>
                      ) : null}
                    </Box>
                  </>
                ) : null}

                {!details.latestAcceptance && !details.latestContract?.complete ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {t(
                      'admin.businesses.noAgreement',
                      'No merchant agreement on file. Ask the business to sign the agreement in the app.'
                    )}
                  </Alert>
                ) : null}

                {details.latestAcceptance ? (
                  <Box sx={{ mt: details.latestContract?.boldSignEnabled ? 2 : 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.businesses.signerName', 'Signer')}:{' '}
                      {details.latestAcceptance.signer_legal_name} (
                      {details.latestAcceptance.agreement_version})
                    </Typography>
                    {details.latestAcceptance.pdf_upload_id ? (
                      <Button
                        size="small"
                        sx={{ mt: 1 }}
                        startIcon={<VisibilityIcon />}
                        onClick={() => {
                          const id = details.latestAcceptance!.pdf_upload_id!;
                          void ensurePreviewUrl(id).then((url) => {
                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                          });
                        }}
                      >
                        {t(
                          'admin.businesses.viewAgreementPdf',
                          'View signed PDF'
                        )}
                      </Button>
                    ) : null}
                  </Box>
                ) : null}
              </Paper>

              {/* Identity */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('admin.businesses.idDocuments', 'Identity documents')}
                </Typography>
                {details.identityDocuments.length === 0 ? (
                  <Alert severity="info">
                    {t(
                      'admin.businesses.noIdDocument',
                      'No ID document uploaded. Ask the business to upload ID from Documents.'
                    )}
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {details.identityDocuments.map((doc) => {
                      const rejected =
                        Boolean(doc.note?.trim()) && !doc.is_approved;
                      const statusLabel = doc.is_approved
                        ? t('admin.uploads.approved', 'Approved')
                        : rejected
                          ? t('admin.uploads.rejected', 'Rejected')
                          : t('admin.uploads.pending', 'Pending');
                      const url = previewUrlById[doc.id];
                      const showImage = isImageContentType(
                        doc.content_type,
                        doc.file_name
                      );
                      const showPdf = isPdfContentType(
                        doc.content_type,
                        doc.file_name
                      );
                      return (
                        <Box
                          key={doc.id}
                          sx={{
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            pb: 2,
                            '&:last-child': { borderBottom: 'none', pb: 0 },
                          }}
                        >
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ sm: 'flex-start' }}
                            gap={1}
                            sx={{ mb: 1 }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {doc.file_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {`${doc.document_type?.name ?? ''} • ${statusLabel}`}
                              </Typography>
                              {rejected ? (
                                <Typography
                                  variant="caption"
                                  color="error"
                                  display="block"
                                >
                                  {doc.note}
                                </Typography>
                              ) : null}
                            </Box>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {!doc.is_approved && !rejected ? (
                                <Button
                                  size="small"
                                  color="success"
                                  startIcon={
                                    approveLoadingId === doc.id ? (
                                      <CircularProgress size={14} />
                                    ) : (
                                      <CheckCircleIcon />
                                    )
                                  }
                                  disabled={approveLoadingId !== null}
                                  onClick={() => void handleApproveUpload(doc.id)}
                                >
                                  {t('admin.uploads.approve', 'Approve')}
                                </Button>
                              ) : null}
                              {!doc.is_approved ? (
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<BlockIcon />}
                                  onClick={() => {
                                    setRejectingDocId(doc.id);
                                    setRejectMessage('');
                                  }}
                                >
                                  {t('admin.agents.reject', 'Reject')}
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>

                          {previewLoadingId === doc.id && !url ? (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                py: 3,
                              }}
                            >
                              <CircularProgress size={24} />
                            </Box>
                          ) : null}

                          {url && showImage ? (
                            <Box
                              component="img"
                              src={url}
                              alt={doc.file_name}
                              sx={{
                                display: 'block',
                                maxWidth: '100%',
                                maxHeight: '50vh',
                                objectFit: 'contain',
                                borderRadius: 1,
                                bgcolor: 'action.hover',
                              }}
                            />
                          ) : null}

                          {url && showPdf ? (
                            <Box
                              component="iframe"
                              src={url}
                              title={doc.file_name}
                              sx={{
                                width: '100%',
                                height: '50vh',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                              }}
                            />
                          ) : null}

                          {url && !showImage && !showPdf ? (
                            <Alert severity="info">
                              {t(
                                'admin.businesses.previewUnsupported',
                                'Preview not available for this file type.'
                              )}
                            </Alert>
                          ) : null}

                          {url ? (
                            <Button
                              size="small"
                              sx={{ mt: 1 }}
                              startIcon={<OpenInNewIcon />}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t(
                                'admin.businesses.openFullSize',
                                'Open full size'
                              )}
                            </Button>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              {/* Payment */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('admin.businesses.paymentAccounts', 'Payment accounts')}
                </Typography>
                {rail === 'stripe' ? (
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'admin.businesses.stripePaymentHelp',
                      'Stripe Connect status updates automatically. No mobile money confirmation is needed.'
                    )}
                    {stripeAccount
                      ? ` (${stripeAccount.capability_status})`
                      : ''}
                  </Typography>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t(
                        'admin.businesses.confirmMobileMoneyHelp',
                        'Confirm that this merchant’s mobile money account can receive payouts. This is the last payment step for non-Stripe businesses.'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      mobile_money:{' '}
                      {mmAccount?.capability_status ||
                        t('admin.businesses.paymentNotStarted', 'not started')}
                      {mmAccount?.rejection_reason
                        ? ` — ${mmAccount.rejection_reason}`
                        : ''}
                    </Typography>
                    {mmVerified &&
                    details.business.lifecycle_status === 'created' ? (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        {t(
                          'admin.businesses.paymentConfirmedStillDraft',
                          'Payment confirmed. Approve a product to leave Draft.'
                        )}
                      </Alert>
                    ) : null}
                  </>
                )}
                {(details.paymentAccounts?.length ?? 0) > 0 ? (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {details.paymentAccounts!.map((account) => (
                      <Typography
                        key={account.id}
                        variant="body2"
                        color="text.secondary"
                      >
                        {account.provider}: {account.capability_status}
                        {account.rejection_reason
                          ? ` — ${account.rejection_reason}`
                          : ''}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Paper>

              {/* Catalog */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t(
                    'admin.businesses.catalogSection',
                    'Catalog / storefront'
                  )}
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    {catalog?.hasLocation
                      ? t(
                          'admin.businesses.catalogHasLocation',
                          'Active location: yes'
                        )
                      : t(
                          'admin.businesses.catalogMissingLocation',
                          'Active location: no'
                        )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {catalog?.hasApprovedItem
                      ? t(
                          'admin.businesses.catalogHasApprovedProduct',
                          'Approved product: yes'
                        )
                      : t(
                          'admin.businesses.catalogMissingApprovedProduct',
                          'Approved product: no'
                        )}
                    {catalog?.hasPendingItem && !catalog?.hasApprovedItem
                      ? ` (${t(
                          'admin.businesses.catalogPendingProduct',
                          'item pending moderation'
                        )})`
                      : ''}
                  </Typography>
                </Stack>
                {!catalog?.complete ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {t(
                      'admin.businesses.catalogDraftHelp',
                      'Business stays Draft until a product is approved at an active location (and the contract is signed).'
                    )}
                  </Alert>
                ) : null}
              </Paper>
            </Box>
          ) : null}
        </DialogContent>

        <AppBar
          position="sticky"
          color="default"
          elevation={3}
          sx={{ top: 'auto', bottom: 0 }}
        >
          <Toolbar sx={{ justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
            {canConfirmMobileMoney ? (
              <Button
                variant="contained"
                disabled={verifyLoading}
                startIcon={
                  verifyLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <VerifiedUserIcon />
                  )
                }
                onClick={() => void handleConfirmMobileMoney()}
              >
                {t(
                  'admin.businesses.confirmMobileMoneyReady',
                  'Confirm mobile money ready'
                )}
              </Button>
            ) : null}
          </Toolbar>
        </AppBar>
      </Dialog>

      <Dialog
        open={!!rejectingDocId}
        onClose={() => !rejectLoading && setRejectingDocId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('admin.agents.rejectDocument', 'Reject document')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t(
              'admin.businesses.rejectMessageHelp',
              'Explain what is wrong so the merchant can upload a corrected document. They will receive this reason by email.'
            )}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            required
            label={t('admin.agents.rejectMessage', 'Message to user')}
            value={rejectMessage}
            onChange={(e) => setRejectMessage(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRejectingDocId(null)}
            disabled={rejectLoading}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={rejectLoading || !rejectMessage.trim()}
            onClick={() => void handleRejectUpload()}
          >
            {rejectLoading ? (
              <CircularProgress size={20} />
            ) : (
              t('admin.agents.reject', 'Reject')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export function formatVerificationBlocker(
  blocker: AdminVerificationBlocker | string,
  t: (key: string, fallback: string) => string
): string {
  return blockerLabel(blocker as AdminVerificationBlocker, t);
}
