import { ContentCopy, Share } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessReferrals } from '../../hooks/useBusinessReferrals';

const BusinessReferralCodeCard: React.FC = () => {
  const { t } = useTranslation();
  const { summary, loading } = useBusinessReferrals();
  const [copied, setCopied] = useState(false);

  if (loading || !summary?.businessCode) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.businessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = async () => {
    const text = t('business.referrals.shareText', {
      defaultValue:
        'Join Rendasua with my business code {{code}} and grow with us!',
      code: summary.businessCode,
    });
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to copy
      }
    }
    await handleCopy();
  };

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
          {t(
            'business.referrals.sideCashTitle',
            'Earn on the side — refer businesses'
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('business.referrals.sideCashBody', {
            defaultValue:
              'Share your code. When a referred business is identified and adds at least {{minItems}} approved items, you earn {{amount}} {{currency}}.',
            minItems: summary.minApprovedItems,
            amount: summary.referralAmount,
            currency: summary.currency,
          })}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ mb: 0.5 }}
        >
          {t('business.referrals.yourCode', 'Your business referral code')}
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
            {summary.businessCode}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={
                copied
                  ? t('business.referrals.copied', 'Copied!')
                  : t('business.referrals.copyCode', 'Copy code')
              }
            >
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('business.referrals.share', 'Share')}>
              <IconButton size="small" onClick={handleShare}>
                <Share fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BusinessReferralCodeCard;
