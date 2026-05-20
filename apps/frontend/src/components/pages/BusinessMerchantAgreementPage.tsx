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
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  merchantAgreementPreviewVars,
  renderMerchantAgreementHtml,
} from '../../utils/renderMerchantAgreementHtml';

export const BusinessMerchantAgreementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { profile } = useUserProfileContext();
  const [html, setHtml] = useState('');
  const [version, setVersion] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const defaultName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : '';

  useEffect(() => {
    if (defaultName && !legalName) setLegalName(defaultName);
  }, [defaultName, legalName]);

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
    void loadAgreement();
  }, [loadAgreement]);

  const submit = async () => {
    if (!apiClient || !agreed || !legalName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/business-verification/merchant-agreement/accept', {
        legalName: legalName.trim(),
        agreementVersion: version,
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

  if (done) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('business.verification.agreementSuccess', 'Agreement accepted successfully.')}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/documents')}>
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
      <Paper variant="outlined" sx={{ p: 2, mb: 2, maxHeight: 420, overflow: 'auto' }}>
        <Box dangerouslySetInnerHTML={{ __html: html }} />
      </Paper>
      <FormControlLabel
        control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
        label={t(
          'business.verification.agreeCheckbox',
          'I have read and agree to the Merchant Agreement.'
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
        disabled={busy || !agreed || !legalName.trim() || !version}
        onClick={() => void submit()}
      >
        {t('business.verification.acceptAgreement', 'Accept agreement')}
      </Button>
    </Container>
  );
};

export default BusinessMerchantAgreementPage;
