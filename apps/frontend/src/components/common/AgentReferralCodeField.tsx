import { Alert, Box, CircularProgress, TextField } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAgentReferralLookup,
  type AgentReferralLookupResult,
} from '../../hooks/useAgentReferralLookup';

export interface AgentReferralCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  labelKey?: string;
  labelDefault?: string;
  helpKey?: string;
  helpDefault?: string;
  lookupResult?: AgentReferralLookupResult | null;
  lookupLoading?: boolean;
  lookupError?: string | null;
}

const AgentReferralCodeField: React.FC<AgentReferralCodeFieldProps> = ({
  value,
  onChange,
  labelKey = 'agent.referrals.referralCodeLabel',
  labelDefault = 'Referral code (optional)',
  helpKey = 'agent.referrals.referralCodeHelp',
  helpDefault = 'Enter the code of the agent who referred you (if any).',
  lookupResult: externalResult,
  lookupLoading: externalLoading,
  lookupError: externalError,
}) => {
  const { t } = useTranslation();
  const useExternalLookup = externalLoading !== undefined;
  const internalLookup = useAgentReferralLookup(useExternalLookup ? '' : value);
  const result = useExternalLookup ? (externalResult ?? null) : internalLookup.result;
  const loading = useExternalLookup ? Boolean(externalLoading) : internalLookup.loading;
  const error = useExternalLookup ? (externalError ?? null) : internalLookup.error;

  const trimmed = value.trim().toUpperCase();
  const showLookup = trimmed.length === 6;
  const displayName = result?.firstName || result?.fullName;
  const lookupMatchesCode = result?.agentCode?.toUpperCase() === trimmed;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        label={t(labelKey, labelDefault)}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        fullWidth
        inputProps={{ maxLength: 6 }}
        helperText={t(helpKey, helpDefault)}
      />
      {showLookup && loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={14} />
          <Box component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {t('agent.referrals.lookupLoading', 'Looking up agent...')}
          </Box>
        </Box>
      )}
      {showLookup && !loading && lookupMatchesCode && result && (
        <Alert severity="success" sx={{ py: 0.5 }}>
          {t('agent.referrals.lookupSuccess', 'Referred by {{name}}', {
            name: displayName,
          })}
        </Alert>
      )}
      {showLookup && !loading && !lookupMatchesCode && error && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          {t('agent.referrals.lookupError', 'No agent found for this code')}
        </Alert>
      )}
    </Box>
  );
};

export default AgentReferralCodeField;
