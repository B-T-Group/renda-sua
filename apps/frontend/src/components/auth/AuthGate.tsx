import CloseRounded from '@mui/icons-material/CloseRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LoginRounded from '@mui/icons-material/LoginRounded';
import PanToolAltOutlined from '@mui/icons-material/PanToolAltOutlined';
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined';
import {
  Box,
  Dialog,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthGateOtp } from '../../hooks/useAuthGateOtp';
import type { AuthGateIntent, AuthGateStep } from '../../types/authGate';
import { getAuthGateContextCopy } from '../../utils/authGateContextCopy';
import AuthGateCodeStep from './AuthGateCodeStep';
import AuthGateFinishStep from './AuthGateFinishStep';
import AuthGateIdentifierStep from './AuthGateIdentifierStep';

export interface AuthGateProps {
  open: boolean;
  step: AuthGateStep;
  intent: AuthGateIntent | null;
  onStepChange: (step: AuthGateStep) => void;
  onDismiss: () => void;
  onAuthSuccess: (session: {
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
  }) => void;
}

function ContextIcon({ context }: { context: AuthGateIntent['context'] }) {
  if (context === 'favorites') return <FavoriteBorderRounded color="error" />;
  if (context === 'checkout') return <LockOutlined color="primary" />;
  if (context === 'interest') return <PanToolAltOutlined color="primary" />;
  if (context === 'foods_cart') return <ShoppingBagOutlined color="primary" />;
  return <LoginRounded color="primary" />;
}

const AuthGate: React.FC<AuthGateProps> = ({
  open,
  step,
  intent,
  onStepChange,
  onDismiss,
  onAuthSuccess,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const otp = useAuthGateOtp();
  const verifyRef = useRef(otp.verifyOtp);
  verifyRef.current = otp.verifyOtp;
  const finishRef = useRef(otp.finishAccount);
  finishRef.current = otp.finishAccount;
  const [finishFlowId, setFinishFlowId] = useState<string | null>(null);

  const { resetFlow } = otp;
  useEffect(() => {
    if (!open) {
      resetFlow();
      setFinishFlowId(null);
    }
  }, [open, resetFlow]);

  const copy = getAuthGateContextCopy(intent?.context ?? 'generic');

  const handleVerify = useCallback(
    async (code: string) => {
      const result = await verifyRef.current(code);
      if (result.ok && result.session) {
        onAuthSuccess(result.session);
        return;
      }
      if (result.finishAccount && result.flowId) {
        setFinishFlowId(result.flowId);
        onStepChange('finish');
      }
    },
    [onAuthSuccess, onStepChange, otp]
  );

  const handleFinish = useCallback(
    async (payload: {
      first_name: string;
      last_name: string;
      accept_terms: boolean;
    }) => {
      if (!finishFlowId) return;
      const result = await finishRef.current({
        flowId: finishFlowId,
        ...payload,
      });
      if (result.ok && result.session) {
        onAuthSuccess(result.session);
      }
    },
    [finishFlowId, onAuthSuccess]
  );

  const handleStart = useCallback(
    async (payload: { email?: string; phone_number?: string }) => {
      const ok = await otp.startFlow(payload);
      if (ok) onStepChange('code');
    },
    [onStepChange, otp]
  );

  const shell = (
    <Stack spacing={2} sx={{ px: 2.5, pt: 2, pb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton aria-label={t('common.close', 'Close')} onClick={onDismiss} size="small">
          <CloseRounded />
        </IconButton>
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ContextIcon context={intent?.context ?? 'generic'} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800}>
            {t(copy.titleKey, copy.titleDefault)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(copy.bodyKey, copy.bodyDefault)}
          </Typography>
        </Box>
      </Stack>
      {step === 'finish' && finishFlowId ? (
        <AuthGateFinishStep
          busy={otp.busy}
          error={otp.error}
          onClearError={() => otp.setError(null)}
          onSubmit={handleFinish}
        />
      ) : step === 'identifier' || !otp.flow ? (
        <AuthGateIdentifierStep
          disabled={otp.busy}
          error={otp.error}
          onClearError={() => otp.setError(null)}
          onValidationError={(msg) => otp.setError(msg)}
          onSubmit={handleStart}
        />
      ) : (
        <AuthGateCodeStep
          flow={otp.flow}
          busy={otp.busy}
          error={otp.error}
          onClearError={() => otp.setError(null)}
          onBack={() => {
            otp.resetFlow();
            onStepChange('identifier');
          }}
          onResend={() => void otp.resendFlow()}
          onVerify={handleVerify}
        />
      )}
    </Stack>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onDismiss}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxWidth: 480, mx: 'auto' },
        }}
      >
        {shell}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onDismiss} maxWidth="xs" fullWidth>
      {shell}
    </Dialog>
  );
};

export default AuthGate;
