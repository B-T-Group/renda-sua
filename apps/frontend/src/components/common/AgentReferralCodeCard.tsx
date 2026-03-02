import { ContentCopy } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AgentReferralCodeCardProps {
  agentCode: string;
}

const AgentReferralCodeCard: React.FC<AgentReferralCodeCardProps> = ({
  agentCode,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(agentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ mb: 0.5 }}
        >
          {t(
            'agent.referrals.yourCode',
            'Your agent referral code'
          )}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            px: 1.5,
            py: 0.75,
            bgcolor: 'background.default',
          }}
        >
          <Typography
            variant="h6"
            component="span"
            sx={{ letterSpacing: '0.18em', fontWeight: 600 }}
          >
            {agentCode}
          </Typography>
          <Tooltip
            title={
              copied
                ? t('agent.referrals.copied', 'Copied!')
                : t('agent.referrals.copyCode', 'Copy code')
            }
          >
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {t(
            'agent.referrals.shareHint',
            'Share this code with other agents so you can earn referral commissions when they sign up.'
          )}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default AgentReferralCodeCard;

