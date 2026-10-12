import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { signatureStatusKey, type SignatureCheckResult } from '../../utils/waitForAgentSignature';

/** "Checking document signature": spinner while polling, then the real status + next actions. */
export function SignatureCheckPanel(props: {
  result: SignatureCheckResult | null;
  busy: boolean;
  onCheckAgain: () => void;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  const { result } = props;
  return (
    <Stack spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
      <Typography variant="h6">
        {t('agentContract.checkTitle', 'Checking document signature')}
      </Typography>
      {!result ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={28} />
          <Typography color="text.secondary">
            {t('agentContract.checkBody', 'Waiting for BoldSign to confirm your signature. This can take up to a minute.')}
          </Typography>
        </Box>
      ) : (
        <>
          <Alert severity={['declined', 'expired', 'cancelled', 'failed'].includes(signatureStatusKey(result.status)) ? 'error' : 'warning'}>
            {t('agentContract.checkResult', 'Your document is not signed yet. Current status: {{status}}.', {
              status: t(`agentContract.state.${signatureStatusKey(result.status)}`, signatureStatusKey(result.status)),
            })}
          </Alert>
          <Typography color="text.secondary">
            {t('agentContract.resumeHint', 'Open the BoldSign email to finish signing, or we can email you the link again.')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={props.busy} onClick={props.onCheckAgain}>
              {t('agentContract.checkAgain', 'Check again')}
            </Button>
            <Button variant="outlined" disabled={props.busy} onClick={props.onResume}>
              {t('agentContract.resume', 'Resume signing')}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}
