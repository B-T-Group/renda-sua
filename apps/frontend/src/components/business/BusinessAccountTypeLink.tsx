import { Box, Link, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessAccountType } from '../../hooks/useBusinessAccountType';

/**
 * Subtle dashboard link to the business plans page, tinted by plan color.
 */
export function BusinessAccountTypeLink() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { plan } = useBusinessAccountType();
  const planLabel = t(plan.labelKey, plan.defaultLabel);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Link
        component="button"
        type="button"
        underline="none"
        onClick={() => navigate('/business/account-type')}
        aria-label={t(
          'business.accountType.dashboardLinkA11y',
          'Account type: {{type}}. Open plans.',
          { type: planLabel }
        )}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          border: `1px solid ${plan.color}33`,
          backgroundColor: plan.softColor,
          borderRadius: 1.5,
          cursor: 'pointer',
          px: 1.25,
          py: 0.5,
          color: 'text.secondary',
          typography: 'body2',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          '&:hover': {
            borderColor: plan.color,
            boxShadow: 1,
          },
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: plan.color,
            flexShrink: 0,
          }}
        />
        <Typography component="span" variant="body2" color="text.secondary">
          {t('business.accountType.dashboardLinkPrefix', 'Account type:')}{' '}
          <Box component="span" sx={{ color: plan.color, fontWeight: 700 }}>
            {planLabel}
          </Box>
        </Typography>
        <Typography component="span" variant="body2" sx={{ color: plan.color, fontWeight: 700 }}>
          →
        </Typography>
      </Link>
    </Box>
  );
}

export default BusinessAccountTypeLink;
