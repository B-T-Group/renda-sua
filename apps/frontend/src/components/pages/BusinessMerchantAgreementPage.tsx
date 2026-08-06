import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  merchantAgreementPreviewVars,
  renderMerchantAgreementHtml,
} from '../../utils/renderMerchantAgreementHtml';
import type { MerchantContractStatus } from '../../hooks/useBusinessVerification';

const SCROLL_END_THRESHOLD_PX = 24;
const CONTRACT_DOC_TYPE = 'rendasua_contract_agreement';

type ApiClient = NonNullable<ReturnType<typeof useApiClient>>;

function buildWebDeviceInfo() {
  return {
    platform: 'web',
    osName: navigator.platform || undefined,
    osVersion: undefined,
    modelName: navigator.userAgent || undefined,
    appVersion: undefined,
    brand: undefined,
  };
}

async function fetchBoldSignPdfUrl(
  apiClient: ApiClient,
  contract: MerchantContractStatus | null
): Promise<string | null> {
  if (!contract?.canDownload || !contract.contractId) return null;
  const bold = await apiClient.get<{
    success: boolean;
    data: { url?: string };
  }>(`/business-contracts/${contract.contractId}/download`);
  return bold.data.data?.url ?? null;
}

async function findLatestContractUploadId(
  apiClient: ApiClient
): Promise<string | null> {
  const res = await apiClient.get<{
    success: boolean;
    data: {
      uploads: Array<{
        id: string;
        created_at?: string;
        document_type?: { name?: string };
      }>;
    };
  }>('/uploads/me');
  const matches = (res.data.data.uploads ?? []).filter(
    (u) => u.document_type?.name === CONTRACT_DOC_TYPE
  );
  matches.sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );
  return matches[0]?.id ?? null;
}

async function fetchUploadContractPdfUrl(
  apiClient: ApiClient
): Promise<string | null> {
  const uploadId = await findLatestContractUploadId(apiClient);
  if (!uploadId) return null;
  const view = await apiClient.get<{
    success?: boolean;
    presigned_url?: string;
    data?: { presigned_url?: string; url?: string };
  }>(`/uploads/${uploadId}/view`);
  return (
    view.data.presigned_url ||
    view.data.data?.presigned_url ||
    view.data.data?.url ||
    null
  );
}

function navigateToSignedPdf(popup: Window | null, url: string) {
  if (popup) {
    popup.location.href = url;
    return;
  }
  window.location.assign(url);
}

async function resolveSignedPdfUrl(
  apiClient: ApiClient,
  contract: MerchantContractStatus | null
): Promise<string | null> {
  if (contract?.canDownload && contract.contractId) {
    return fetchBoldSignPdfUrl(apiClient, contract);
  }
  // BoldSign rail without a downloadable PDF yet — do not open a stale upload.
  if (contract?.boldSignEnabled) return null;
  return fetchUploadContractPdfUrl(apiClient);
}

export const BusinessMerchantAgreementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { profile } = useUserProfileContext();
  const [html, setHtml] = useState('');
  const [version, setVersion] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [contract, setContract] = useState<MerchantContractStatus | null>(null);
  const [agreementComplete, setAgreementComplete] = useState(false);
  const [stillOnboarding, setStillOnboarding] = useState(false);
  const [paymentRail, setPaymentRail] = useState<'stripe' | 'mobile_money' | null>(
    null
  );
  const [statusLoading, setStatusLoading] = useState(true);
  const [openingSigned, setOpeningSigned] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const defaultName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : '';

  useEffect(() => {
    if (defaultName && !legalName) setLegalName(defaultName);
  }, [defaultName, legalName]);

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END_THRESHOLD_PX;
    if (nearBottom) setHasScrolledToEnd(true);
  }, []);

  useEffect(() => {
    // Content may fit without scrolling.
    const id = window.setTimeout(checkScrollEnd, 150);
    return () => window.clearTimeout(id);
  }, [html, checkScrollEnd]);

  const loadStatus = useCallback(async () => {
    if (!apiClient) return;
    setStatusLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: {
          contract?: MerchantContractStatus;
          steps?: { agreement?: { complete?: boolean } };
          isOnboarding?: boolean;
          paymentRail?: 'stripe' | 'mobile_money';
        };
      }>('/business-verification/status');
      if (res.data.success) {
        setContract(res.data.data.contract ?? null);
        setAgreementComplete(
          res.data.data.contract?.complete === true ||
            res.data.data.steps?.agreement?.complete === true
        );
        setStillOnboarding(res.data.data.isOnboarding === true);
        setPaymentRail(res.data.data.paymentRail ?? null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load contract status');
    } finally {
      setStatusLoading(false);
    }
  }, [apiClient]);

  const loadAgreement = useCallback(async () => {
    if (!apiClient || !profile) return;
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { html: string; version: string; locale?: string };
      }>('/business-verification/merchant-agreement');
      if (res.data.success) {
        const { html: raw, version: v, locale } = res.data.data;
        setVersion(v);
        setHasScrolledToEnd(false);
        const vars = merchantAgreementPreviewVars(
          profile,
          v,
          locale ?? i18n.language ?? 'en'
        );
        setHtml(renderMerchantAgreementHtml(raw, vars));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load agreement');
    }
  }, [apiClient, profile, i18n.language]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!contract?.boldSignEnabled && !agreementComplete) {
      void loadAgreement();
    }
  }, [contract?.boldSignEnabled, agreementComplete, loadAgreement]);

  const openSignedContract = useCallback(async () => {
    if (!apiClient) return;
    setOpeningSigned(true);
    setError(null);
    const popup = window.open('about:blank', '_blank');
    try {
      const url = await resolveSignedPdfUrl(apiClient, contract);
      if (!url) {
        popup?.close();
        setError(
          t(
            'business.contract.signedPdfMissing',
            'Signed contract not found in your documents yet.'
          )
        );
        return;
      }
      navigateToSignedPdf(popup, url);
    } catch (e: any) {
      popup?.close();
      setError(
        e?.message ||
          t(
            'business.contract.openSignedFailed',
            'Could not open the signed contract.'
          )
      );
    } finally {
      setOpeningSigned(false);
    }
  }, [apiClient, contract, t]);

  const resendContract = async () => {
    if (!apiClient) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/business-contracts/resend');
      await loadStatus();
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          t('business.contract.resendFailed', 'Failed to resend contract')
      );
    } finally {
      setBusy(false);
    }
  };

  const refreshContract = async () => {
    if (!apiClient) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/business-contracts/refresh');
      await loadStatus();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to refresh');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!apiClient || !agreed || !hasScrolledToEnd || !legalName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/business-verification/merchant-agreement/accept', {
        legalName: legalName.trim(),
        agreementVersion: version,
        deviceInfo: buildWebDeviceInfo(),
      });
      setDone(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Failed to accept agreement'
      );
    } finally {
      setBusy(false);
    }
  };

  if (statusLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography>{t('common.loading', 'Loading...')}</Typography>
      </Container>
    );
  }

  if ((agreementComplete && !done) || (contract?.boldSignEnabled && contract.complete)) {
    const continueTo = paymentRail === 'stripe' ? '/dashboard' : '/documents';
    const continueLabel =
      paymentRail === 'stripe'
        ? t('business.setup.ctaPayouts', 'Set up payouts')
        : t('business.verification.uploadId', 'Upload identification');
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          {t(
            'business.contract.signedBody',
            'Your partnership agreement is on file. You can view the signed PDF anytime.'
          )}
        </Alert>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          disabled={openingSigned}
          onClick={() => void openSignedContract()}
        >
          {t('business.contract.viewSigned', 'View signed contract')}
        </Button>
        {stillOnboarding ? (
          <Button sx={{ ml: 1 }} variant="outlined" onClick={() => navigate(continueTo)}>
            {continueLabel}
          </Button>
        ) : null}
        <Button sx={{ ml: 1 }} onClick={() => navigate('/dashboard')}>
          {t('business.verification.backToDashboard', 'Back to dashboard')}
        </Button>
      </Container>
    );
  }

  if (contract?.boldSignEnabled) {
    const statusKey = contract.status ?? 'sent';
    const statusLabel = t(
      `business.contract.status.${statusKey}`,
      statusKey.replace('_', ' ')
    );

    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('business.contract.pendingTitle', 'Sign your merchant agreement')}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t(
            'business.contract.pendingNotice',
            'We sent a secure signing link to your email via BoldSign. Open the email and sign electronically to continue.'
          )}
        </Alert>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('business.contract.statusLabel', 'Status')}
          </Typography>
          <Typography variant="h6">{statusLabel}</Typography>
          {contract.version ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {t('business.contract.version', 'Version')}: {contract.version}
            </Typography>
          ) : null}
        </Paper>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Button variant="contained" disabled={busy} onClick={() => void resendContract()}>
          {t('business.contract.resend', 'Resend signing email')}
        </Button>
        <Button
          sx={{ ml: 1 }}
          variant="outlined"
          disabled={busy}
          onClick={() => void refreshContract()}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
        <Button sx={{ ml: 1 }} onClick={() => navigate('/dashboard')}>
          {t('business.verification.backToDashboard', 'Back to dashboard')}
        </Button>
      </Container>
    );
  }

  if (done) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('business.verification.agreementSuccess', 'Agreement accepted successfully.')}
        </Alert>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          disabled={openingSigned}
          onClick={() => void openSignedContract()}
          sx={{ mr: 1 }}
        >
          {t('business.contract.viewSigned', 'View signed contract')}
        </Button>
        <Button variant="outlined" onClick={() => navigate('/documents')}>
          {t('business.verification.uploadId', 'Upload identification')}
        </Button>
        <Button sx={{ ml: 1 }} onClick={() => navigate('/dashboard')}>
          {t('business.verification.backToDashboard', 'Back to dashboard')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('business.verification.agreementPageTitle', 'Merchant partnership agreement')}
      </Typography>
      <Paper
        ref={scrollRef}
        variant="outlined"
        onScroll={checkScrollEnd}
        sx={{ p: 2, mb: 2, maxHeight: 420, overflow: 'auto' }}
      >
        <Box dangerouslySetInnerHTML={{ __html: html }} />
      </Paper>
      {!hasScrolledToEnd ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t(
            'business.verification.scrollHint',
            'Please scroll to the end of the agreement before accepting.'
          )}
        </Typography>
      ) : null}
      <FormControlLabel
        control={
          <Checkbox
            checked={agreed}
            disabled={!hasScrolledToEnd}
            onChange={(e) => setAgreed(e.target.checked)}
          />
        }
        label={t(
          'business.verification.agreeCheckbox',
          'I have read and agree to the Merchant Partnership Agreement.'
        )}
      />
      <TextField
        fullWidth
        label={t('business.verification.legalName', 'Full legal name')}
        value={legalName}
        onChange={(e) => setLegalName(e.target.value)}
        margin="normal"
      />
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      <Button
        variant="contained"
        disabled={busy || !agreed || !hasScrolledToEnd || !legalName.trim() || !version}
        onClick={() => void submit()}
      >
        {t('business.verification.acceptAgreement', 'Accept agreement')}
      </Button>
    </Container>
  );
};

export default BusinessMerchantAgreementPage;
