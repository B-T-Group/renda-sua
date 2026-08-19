import { ContentCopy } from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type AdminReferredBy = {
  kind: 'agent' | 'business';
  name: string;
  codeUsed: string | null;
};

export interface AdminReferralMetaProps {
  referralCode?: string;
  referredBy?: AdminReferredBy | null;
  createdAt?: string;
  onApply?: () => void;
  showReferral?: boolean;
}

export function formatAdminCreatedAt(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export const AdminReferralMeta: React.FC<AdminReferralMetaProps> = ({
  referralCode,
  referredBy,
  createdAt,
  onApply,
  showReferral = true,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const createdLabel = formatAdminCreatedAt(createdAt);

  const handleCopy = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {createdLabel ? (
        <Typography variant="body2" color="text.secondary">
          {t('admin.users.createdAt', 'Created {{date}}', { date: createdLabel })}
        </Typography>
      ) : null}
      {showReferral ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('admin.referrals.code', 'Referral code')}
          </Typography>
          {referralCode ? (
            <>
              <Chip label={referralCode} size="small" sx={{ letterSpacing: '0.08em' }} />
              <Tooltip
                title={
                  copied
                    ? t('admin.referrals.copied', 'Copied!')
                    : t('admin.referrals.copyCode', 'Copy code')
                }
              >
                <IconButton size="small" onClick={handleCopy} aria-label="copy">
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('admin.referrals.noCode', 'No referral code')}
            </Typography>
          )}
          {referredBy ? (
            <Chip
              size="small"
              variant="outlined"
              label={t('admin.referrals.referredBy', 'Referred by {{name}}', {
                name: referredBy.name,
              })}
            />
          ) : onApply ? (
            <Button size="small" variant="outlined" onClick={onApply}>
              {t('admin.referrals.apply', 'Apply referral')}
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};
