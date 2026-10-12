import { Box, CircularProgress } from '@mui/material';
import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  agentAppLocked,
  useAgentContractContext,
} from '../../contexts/AgentContractContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import AgentAgreementPage from '../pages/AgentAgreementPage';

export function AgentContractLock({ children }: { children: React.ReactNode }) {
  const { userType } = useUserProfileContext();
  const location = useLocation();
  const contract = useAgentContractContext();
  const locked = agentAppLocked(userType, contract.status, contract.loading);
  if (userType === 'agent' && contract.loading && !contract.status) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }
  if (locked && !isContractEscape(location.pathname)) {
    return <AgentAgreementPage />;
  }
  return <>{children}</>;
}

function isContractEscape(pathname: string): boolean {
  return (
    pathname.startsWith('/profile') ||
    pathname.startsWith('/complete-profile') ||
    pathname.startsWith('/select-persona') ||
    pathname.startsWith('/auth/')
  );
}
