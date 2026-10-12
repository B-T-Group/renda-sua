import { Alert, Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAgentContract } from '../../hooks/useAgentContract';

export function AgentContractBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, loading } = useAgentContract(true);
  if (loading || !status?.required || status.signed) return null;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" onClick={() => navigate('/agent/agreement')}>
          {t('agentContract.review', 'Review agreement')}
        </Button>
      }
    >
      {t('agentContract.banner', 'Sign your agent agreement to start claiming deliveries.')}
    </Alert>
  );
}
