import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useAgentContractContext } from '../../contexts/AgentContractContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useSupportedCountries } from '../../hooks/useSupportedCountries';
import type { AgentContractStatus } from '../../hooks/useAgentContract';
import { AgentAgreementIllustration } from '../agent/AgentAgreementIllustration';
import { SignatureCheckPanel } from '../agent/SignatureCheckPanel';
import { waitForAgentSignature, type SignatureCheckResult } from '../../utils/waitForAgentSignature';

const AgentAgreementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, loading, error, submit, releaseLock } = useAgentContractContext();
  const { profile, refetch } = useUserProfileContext();
  const apiClient = useApiClient();
  const [nationality, setNationality] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [language, setLanguage] = useState<'en' | 'fr' | null>(null);
  const [notSignedYet, setNotSignedYet] = useState(false);
  const contractLanguage = chosenLanguage(language, status, i18n.language);
  const needs = fieldNeeds(status, contractLanguage);

  useEffect(() => {
    if (appLocale(i18n.language) === contractLanguage) return;
    void i18n.changeLanguage(contractLanguage);
  }, [contractLanguage, i18n]);

  const selectLanguage = (next: 'en' | 'fr') => {
    setLanguage(next);
    void savePreferredLanguage(apiClient, profile, next, refetch);
  };

  const send = () => {
    setNotSignedYet(false);
    void submit('ensure', {
      language: contractLanguage,
      nationality: needs.needsNationality ? nationality.trim() || undefined : undefined,
      idNumber: needs.needsIdNumber ? idNumber.trim() || undefined : undefined,
    });
  };

  // "I have signed": wait up to 60 s for the BoldSign webhook, then show the real status.
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<SignatureCheckResult | null>(null);
  const cancelled = useRef(false);
  const polls = useRef(0);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);
  const goDashboard = useCallback(
    () => openDashboard(navigate, location.pathname, releaseLock),
    [location.pathname, navigate, releaseLock]
  );
  const refresh = async () => {
    setNotSignedYet(false);
    setChecking(true);
    setCheckResult(null);
    polls.current = 0;
    const result = await waitForAgentSignature(
      async () => {
        // Poll the stored status (set by the BoldSign webhook); every 5th check also
        // asks BoldSign directly in case the webhook was missed.
        polls.current += 1;
        if (polls.current % 5 === 1) {
          const next = await submit('refresh');
          if (!next) throw new Error('refresh failed');
          return { signed: next.signed, status: next.status };
        }
        const res = await apiClient.get<{ data: AgentContractStatus }>('/agent-contracts/status');
        return { signed: res.data.data.signed, status: res.data.data.status };
      },
      { isCancelled: () => cancelled.current }
    );
    await finishSignatureCheck(result, {
      submit,
      goDashboard,
      setChecking,
      setCheckResult,
    });
  };
  const resumeSigning = async () => {
    setChecking(false);
    setCheckResult(null);
    await submit('resend');
  };

  useEffect(() => {
    if (status?.signed) goDashboard();
  }, [goDashboard, status?.signed]);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={2} alignItems="flex-start">
        <AgentAgreementIllustration
          label={t('agentContract.illustration', 'Agent agreement')}
        />
        <Typography variant="h5">
          {t('agentContract.title', 'Sign your agent agreement')}
        </Typography>
        <Typography color="text.secondary">
          {t(
            'agentContract.body',
            'Read and sign your agent agreement. You can then claim deliveries and earn commissions.'
          )}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {checking && !status?.signed ? (
          <SignatureCheckPanel
            result={checkResult}
            busy={loading && !!checkResult}
            onCheckAgain={() => void refresh()}
            onResume={() => void resumeSigning()}
          />
        ) : status?.signed ? (
          <SignedState onDone={goDashboard} />
        ) : (
          <PendingState
            loading={loading}
            status={status}
            nationality={nationality}
            idNumber={idNumber}
            language={contractLanguage}
            needsNationality={needs.needsNationality}
            needsIdNumber={needs.needsIdNumber}
            onNationality={setNationality}
            onIdNumber={setIdNumber}
            onLanguage={selectLanguage}
            onSend={send}
            onResend={() => void submit('resend')}
            onRefresh={() => void refresh()}
            notSignedYet={notSignedYet}
          />
        )}
      </Stack>
    </Container>
  );
};

function openDashboard(
  navigate: NavigateFunction,
  pathname: string,
  releaseLock: () => void
) {
  releaseLock();
  if (pathname !== '/dashboard') navigate('/dashboard', { replace: true });
}

async function finishSignatureCheck(
  result: SignatureCheckResult | null,
  actions: {
    submit: (path: 'refresh') => Promise<unknown>;
    goDashboard: () => void;
    setChecking: (value: boolean) => void;
    setCheckResult: (value: SignatureCheckResult | null) => void;
  }
) {
  if (!result) {
    actions.setChecking(false);
    return;
  }
  if (!result.signed) {
    actions.setCheckResult(result);
    return;
  }
  await actions.submit('refresh');
  actions.setChecking(false);
  actions.goDashboard();
}

function SignedState({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Alert severity="success">
        {t('agentContract.signed', 'Your agreement is signed. You can claim deliveries and earn commissions.')}
      </Alert>
      <Button variant="contained" onClick={onDone}>
        {t('agentContract.back', 'Return to dashboard')}
      </Button>
    </>
  );
}

function PendingState(props: {
  loading: boolean;
  status: AgentContractStatus | null;
  nationality: string;
  idNumber: string;
  language: 'en' | 'fr';
  needsNationality: boolean;
  needsIdNumber: boolean;
  onNationality: (value: string) => void;
  onIdNumber: (value: string) => void;
  onLanguage: (value: 'en' | 'fr') => void;
  onSend: () => void;
  onResend: () => void;
  onRefresh: () => void;
  notSignedYet: boolean;
}) {
  const { t } = useTranslation();
  const status = props.status;
  const waiting = status?.status === 'sent' || status?.status === 'viewed';
  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      {status?.missingEmail ? (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" component={Link} to="/profile">
              {t('agentContract.updateProfile', 'Update profile')}
            </Button>
          }
        >
          {t('agentContract.contact', 'Add your email on your profile before we can send the agreement.')}
        </Alert>
      ) : null}
      {status?.signerEmail ? (
        <Alert severity="info">
          {t('agentContract.sendTo', 'We will send the agreement to {{email}}.', {
            email: status.signerEmail,
          })}
        </Alert>
      ) : null}
      {props.notSignedYet ? (
        <Alert severity="warning">
          {t(
            'agentContract.notSignedYet',
            'We have not received your signature yet. Sign the BoldSign email, then try again.'
          )}
        </Alert>
      ) : null}
      {waiting ? (
        <Alert severity="info">
          {t('agentContract.emailed', 'Check {{email}} for the BoldSign email, then refresh.', {
            email: status?.signerEmail || t('agentContract.yourEmail', 'your email'),
          })}
        </Alert>
      ) : null}
      {waiting ? null : (
        <LanguageSelect value={props.language} onChange={props.onLanguage} />
      )}
      {props.needsNationality ? (
        <NationalitySelect value={props.nationality} onChange={props.onNationality} />
      ) : null}
      {props.needsIdNumber ? (
        <TextField
          label={t('agentContract.idNumber', 'ID number')}
          value={props.idNumber}
          onChange={(event) => props.onIdNumber(event.target.value)}
          fullWidth
        />
      ) : null}
      <Box>
        {waiting ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" disabled={props.loading} onClick={props.onResend}>
              {t('agentContract.resend', 'Resend email')}
            </Button>
            <Button variant="contained" onClick={props.onRefresh}>
              {t('agentContract.refresh', 'I have signed – return to dashboard')}
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" disabled={props.loading || !canSend(status, props)} onClick={props.onSend}>
            {t('agentContract.send', 'Email me the agreement')}
          </Button>
        )}
      </Box>
    </Stack>
  );
}

function NationalitySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const { countries, loading } = useSupportedCountries();
  const options = countries.filter((country) => country.signupEnabled !== false);
  useEffect(() => {
    if (value) return;
    const match = countryMatch(options, profile?.country);
    if (match) onChange(match);
  }, [onChange, options, profile?.country, value]);
  return (
    <TextField
      select
      fullWidth
      required
      disabled={loading}
      label={t('agentContract.nationality', 'Nationality')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((country) => (
        <MenuItem key={country.code} value={country.name || country.code}>
          {country.name || country.code}
        </MenuItem>
      ))}
    </TextField>
  );
}

function LanguageSelect({
  value,
  onChange,
}: {
  value: 'en' | 'fr';
  onChange: (value: 'en' | 'fr') => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      select
      fullWidth
      required
      label={t('agentContract.language', 'Contract language')}
      value={value}
      onChange={(event) => onChange(event.target.value as 'en' | 'fr')}
    >
      <MenuItem value="en">{t('agentContract.languageEn', 'English')}</MenuItem>
      <MenuItem value="fr">{t('agentContract.languageFr', 'French')}</MenuItem>
    </TextField>
  );
}

function canSend(
  status: AgentContractStatus | null,
  props: { nationality: string; idNumber: string; needsNationality: boolean; needsIdNumber: boolean }
): boolean {
  if (!status || status.missingEmail) return false;
  if (props.needsNationality && !props.nationality.trim()) return false;
  if (props.needsIdNumber && !props.idNumber.trim()) return false;
  return true;
}

function appLocale(language?: string | null): 'en' | 'fr' {
  return (language ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

async function savePreferredLanguage(
  api: ReturnType<typeof useApiClient>,
  profile: { first_name: string; last_name: string; preferred_language?: string | null } | null,
  language: 'en' | 'fr',
  refetch: () => Promise<unknown>
) {
  if (!profile || appLocale(profile.preferred_language) === language) return;
  try {
    await api.post('/users/me/update', {
      firstName: profile.first_name,
      lastName: profile.last_name,
      preferredLanguage: language,
    });
    await refetch();
  } catch {
    // The screen language already switched.
  }
}

function chosenLanguage(
  picked: 'en' | 'fr' | null,
  status: AgentContractStatus | null,
  appLanguage: string
): 'en' | 'fr' {
  if (picked) return picked;
  if (status?.language) return status.language;
  return appLanguage.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function fieldNeeds(status: AgentContractStatus | null, language: 'en' | 'fr') {
  return status?.byLanguage?.[language] ?? {
    needsNationality: Boolean(status?.needsNationality),
    needsIdNumber: Boolean(status?.needsIdNumber),
  };
}

function countryMatch(
  options: Array<{ code: string; name: string }>,
  country?: string | null
): string | null {
  const code = country?.trim().toUpperCase();
  const match = options.find((option) => option.code.toUpperCase() === code);
  return match ? match.name || match.code : null;
}

export default AgentAgreementPage;
