import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAgentContract } from '../../hooks/useAgentContract';
import { AgentAgreementIllustration } from '../agent/AgentAgreementIllustration';

const AgentAgreementPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, loading, error, submit } = useAgentContract(true);
  const [nationality, setNationality] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const send = () => {
    void submit('ensure', {
      nationality: nationality.trim() || undefined,
      idNumber: idNumber.trim() || undefined,
    });
  };

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
            'We email the agreement for your region and language. Claim deliveries after you sign it.'
          )}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {status?.signed ? (
          <SignedState onDone={() => navigate('/dashboard')} />
        ) : (
          <PendingState
            loading={loading}
            status={status}
            nationality={nationality}
            idNumber={idNumber}
            onNationality={setNationality}
            onIdNumber={setIdNumber}
            onSend={send}
            onResend={() => void submit('resend')}
            onRefresh={() => void submit('refresh')}
          />
        )}
      </Stack>
    </Container>
  );
};

function SignedState({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Alert severity="success">
        {t('agentContract.signed', 'Your agreement is signed. You can claim deliveries.')}
      </Alert>
      <Button variant="contained" onClick={onDone}>
        {t('agentContract.back', 'Return to dashboard')}
      </Button>
    </>
  );
}

function PendingState(props: {
  loading: boolean;
  status: ReturnType<typeof useAgentContract>['status'];
  nationality: string;
  idNumber: string;
  onNationality: (value: string) => void;
  onIdNumber: (value: string) => void;
  onSend: () => void;
  onResend: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const status = props.status;
  const waiting = status?.status === 'sent' || status?.status === 'viewed';
  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      {status?.missingEmail || status?.missingPhone ? (
        <Alert severity="info">
          {t('agentContract.contact', 'Add your email and phone on your profile before we can send the agreement.')}
        </Alert>
      ) : null}
      {waiting ? (
        <Alert severity="info">
          {t('agentContract.emailed', 'Check {{email}} for the BoldSign email, then refresh.', {
            email: status?.signerEmail || t('agentContract.yourEmail', 'your email'),
          })}
        </Alert>
      ) : null}
      {status?.needsNationality ? (
        <TextField
          label={t('agentContract.nationality', 'Nationality')}
          value={props.nationality}
          onChange={(event) => props.onNationality(event.target.value)}
          fullWidth
        />
      ) : null}
      {status?.needsIdNumber ? (
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
            <Button variant="contained" disabled={props.loading} onClick={props.onRefresh}>
              {t('agentContract.refresh', 'I have signed')}
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

function canSend(
  status: ReturnType<typeof useAgentContract>['status'],
  props: { nationality: string; idNumber: string }
): boolean {
  if (!status || status.missingEmail || status.missingPhone) return false;
  if (status.needsNationality && !props.nationality.trim()) return false;
  if (status.needsIdNumber && !props.idNumber.trim()) return false;
  return true;
}

export default AgentAgreementPage;
